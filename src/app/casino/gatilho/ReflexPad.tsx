"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";
import { ATTEMPTS, MAX_DELAY_MS, MIN_DELAY_MS, MIN_HUMAN_MS, PENALTY_MS, average, formatMs } from "@/lib/reflex";
import { sons } from "@/lib/sons";
import { finishAttempt, startAttempt, type ReflexOutcome } from "./actions";

type Phase = "idle" | "arming" | "waiting" | "go" | "sending" | "result" | "done";

const PRACTICE_KEY = "jornal:gatilho:treino";

type PracticeRecord = { bestAvg: number | null; bestShot: number | null };

const NO_RECORD: PracticeRecord = { bestAvg: null, bestShot: null };

function rawRecord(): string | null {
  try {
    return localStorage.getItem(PRACTICE_KEY);
  } catch {
    return null;
  }
}

function parseRecord(raw: string | null): PracticeRecord {
  try {
    if (raw) return JSON.parse(raw) as PracticeRecord;
  } catch {}
  return NO_RECORD;
}

function onStorage(callback: () => void): () => void {
  window.addEventListener("storage", callback);
  return () => window.removeEventListener("storage", callback);
}

function saveRecord(r: PracticeRecord): void {
  try {
    localStorage.setItem(PRACTICE_KEY, JSON.stringify(r));
  } catch {}
}

const LOOK: Record<Phase, string> = {
  idle: "bg-[#141414] text-[#f2c230]",
  arming: "bg-[#141414] text-[#f2c230]",
  waiting: "bg-[#e10600] text-white",
  go: "bg-[#22c55e] text-[#141414]",
  sending: "bg-[#141414] text-[#f2c230]",
  result: "bg-[#fff6d6] text-[#141414]",
  done: "bg-[#fff6d6] text-[#141414]",
};

export type ReflexPadProps = { mode: "practice" } | { mode: "match"; gameId: number; initialTimes: number[] };

export function ReflexPad(props: ReflexPadProps) {
  const router = useRouter();
  const [phase, setPhase] = useState<Phase>("idle");
  const [times, setTimes] = useState<number[]>(props.mode === "match" ? props.initialTimes : []);
  const [last, setLast] = useState<{ ms: number; note: string | null } | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [outcome, setOutcome] = useState<ReflexOutcome | null>(null);
  const record = parseRecord(useSyncExternalStore(onStorage, rawRecord, () => null));
  const phaseRef = useRef<Phase>("idle");
  const goAt = useRef(0);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pad = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, []);

  // Native listener keeps the handler out of reach of __reactProps; scripted events are untrusted.
  const tapRef = useRef<(e: PointerEvent) => void>(() => {});
  useEffect(() => {
    const el = pad.current;
    if (!el) return;
    const onDown = (e: PointerEvent) => tapRef.current(e);
    el.addEventListener("pointerdown", onDown);
    return () => el.removeEventListener("pointerdown", onDown);
  }, []);

  function go(next: Phase): void {
    phaseRef.current = next;
    setPhase(next);
  }

  function arm(delayMs: number): void {
    go("waiting");
    sons.armed();
    timer.current = setTimeout(() => {
      if (phaseRef.current !== "waiting") return;
      phaseRef.current = "go";
      if (pad.current) pad.current.className = `${pad.current.className} !bg-[#22c55e]`;
      goAt.current = performance.now();
      setPhase("go");
    }, delayMs);
  }

  async function begin(): Promise<void> {
    sons.unlock();
    setLast(null);
    setMessage(null);
    if (props.mode === "practice") {
      if (times.length >= ATTEMPTS) setTimes([]);
      arm(MIN_DELAY_MS + Math.floor(Math.random() * (MAX_DELAY_MS - MIN_DELAY_MS + 1)));
      return;
    }
    go("arming");
    const res = await startAttempt(props.gameId);
    if (!res.ok) {
      setMessage(res.error);
      go(res.turnDone ? "done" : "idle");
      if (res.turnDone) router.refresh();
      return;
    }
    setTimes(res.times);
    if (res.abandoned !== null) setMessage("A tentativa que deixaste a meio contou como falhada (1 segundo).");
    arm(res.delayMs);
  }

  function hitSound(ms: number, note: string | null): void {
    if (note === null) sons.shot(ms);
    else sons.foul();
  }

  function practiceResult(ms: number, note: string | null): void {
    hitSound(ms, note);
    const next = [...times, ms];
    setTimes(next);
    setLast({ ms, note });
    let r = record;
    if (note === null && (r.bestShot === null || ms < r.bestShot)) r = { ...r, bestShot: ms };
    if (next.length === ATTEMPTS) {
      const avg = average(next);
      if (r.bestAvg === null || avg < r.bestAvg) r = { ...r, bestAvg: avg };
    }
    if (r !== record) {
      saveRecord(r);
      setTimeout(() => sons.win(3), 350);
    }
    go(next.length === ATTEMPTS ? "done" : "result");
  }

  async function report(reported: number | null): Promise<void> {
    if (props.mode === "practice") {
      if (reported === null) practiceResult(PENALTY_MS, "Partida antecipada!");
      else if (reported < MIN_HUMAN_MS) practiceResult(PENALTY_MS, "Rápido demais para ser humano.");
      else {
        const ms = Math.min(Math.round(reported), PENALTY_MS);
        practiceResult(ms, ms === PENALTY_MS ? "Demasiado lento: conta como 1 segundo." : null);
      }
      return;
    }
    go("sending");
    const res = await finishAttempt(props.gameId, reported);
    if (!res.ok) {
      setMessage(res.error);
      go("idle");
      return;
    }
    hitSound(res.ms, res.note);
    if (res.outcome) {
      const o = res.outcome;
      setTimeout(() => (o.winnerId === null ? sons.tie() : o.myAvg < o.rivalAvg ? sons.victory() : sons.lose()), 450);
    }
    setTimes(res.times);
    setLast({ ms: res.ms, note: res.note });
    setOutcome(res.outcome);
    go(res.turnDone ? "done" : "result");
  }

  function tap(e: PointerEvent): void {
    e.preventDefault();
    if (!e.isTrusted) return;
    const p = phaseRef.current;
    if (p === "waiting") {
      if (timer.current) clearTimeout(timer.current);
      void report(null);
    } else if (p === "go") {
      void report(e.timeStamp - goAt.current);
    } else if (p === "idle" || p === "result" || (p === "done" && props.mode === "practice")) {
      void begin();
    }
  }

  useEffect(() => {
    tapRef.current = tap;
  });

  const attemptNo = Math.min(times.length + (phase === "result" || phase === "done" ? 0 : 1), ATTEMPTS);
  const matchDone = props.mode === "match" && phase === "done";

  return (
    <div className="space-y-3">
      <button
        ref={pad}
        type="button"
        onContextMenu={(e) => e.preventDefault()}
        disabled={matchDone || phase === "arming" || phase === "sending"}
        className={`flex h-72 w-full touch-none select-none flex-col items-center justify-center border-4 border-[#141414] p-4 text-center shadow-[6px_6px_0_#141414] ${LOOK[phase]}`}
      >
        {phase === "idle" && (
          <>
            <span className="text-5xl" aria-hidden="true">⚡</span>
            <span className="mt-2 font-display text-3xl font-black uppercase">Toca para começar</span>
            <span className="mt-1 text-sm font-bold">Tentativa {attemptNo} de {ATTEMPTS}. Espera pelo verde e toca logo.</span>
          </>
        )}
        {(phase === "arming" || phase === "sending") && <span className="font-display text-2xl font-black uppercase">…</span>}
        {phase === "waiting" && (
          <>
            <span className="font-display text-4xl font-black uppercase">Espera…</span>
            <span className="mt-1 text-sm font-bold">Não toques antes do verde.</span>
          </>
        )}
        {phase === "go" && <span className="font-display text-6xl font-black uppercase">Já!</span>}
        {(phase === "result" || phase === "done") && last && (
          <>
            <span className={`font-display text-6xl font-black ${last.note ? "text-[#e10600]" : ""}`}>{last.ms} ms</span>
            {last.note && <span className="mt-1 text-sm font-bold text-[#e10600]">{last.note}</span>}
            <span className="mt-3 text-sm font-bold">
              {phase === "result" ? "Toca para a próxima tentativa." : props.mode === "practice" ? `Média: ${formatMs(average(times))}. Toca para recomeçar.` : `A tua média: ${formatMs(average(times))}.`}
            </span>
          </>
        )}
      </button>

      {message && <p className="border-2 border-[#e10600] bg-white p-2 text-sm font-semibold text-[#e10600]">{message}</p>}

      <ol className="flex gap-2" aria-label="Tentativas">
        {Array.from({ length: ATTEMPTS }, (_, i) => (
          <li key={i} className={`flex-1 border-2 border-[#141414] p-2 text-center text-sm font-black ${times[i] === undefined ? "bg-[#08502b] text-[#fff6d6]/60" : "bg-[#fff6d6] text-[#141414]"}`}>
            {times[i] === undefined ? `${i + 1}.ª` : `${times[i]} ms`}
          </li>
        ))}
      </ol>

      {props.mode === "practice" && (
        <p className="text-center text-sm">
          Recorde neste telemóvel: melhor toque <strong>{record.bestShot ?? "—"}{record.bestShot !== null && " ms"}</strong> · melhor média{" "}
          <strong>{record.bestAvg === null ? "—" : formatMs(record.bestAvg)}</strong>
        </p>
      )}

      {matchDone && (
        <div className="border-4 border-double border-[#f2c230] bg-[#08502b] p-3 text-center">
          {outcome ? (
            <p className="font-display text-2xl font-black text-[#f2c230]">
              {outcome.winnerId === null ? "Empate! Cada um fica com o seu." : outcome.myAvg < outcome.rivalAvg ? "Ganhaste! 🏆" : "Perdeste."}
            </p>
          ) : (
            <p className="font-bold">A tua vez acabou. O adversário já foi avisado.</p>
          )}
          <button type="button" onClick={() => router.refresh()} className="mt-2 text-sm font-bold underline">Ver a partida</button>
        </div>
      )}
    </div>
  );
}
