"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { BALL_R, FRAME_MS, HEAD_SPOT, POCKETS, TABLE, aimGuide, canPlaceCue, isStripe, rack, simulate, type Ball, type Frame, type ShotEvent, type ShotResult } from "@/lib/pool";
import { sons } from "@/lib/sons";
import { shootPool } from "./actions";

const RAIL = 42;
const FULL_W = TABLE.width + RAIL * 2;
const FULL_H = TABLE.height + RAIL * 2;
const FINE_STEP = Math.PI / 720;
const POLL_MS = 15_000;

export type Replay = { n: number; frameMs: number; frames: Frame[]; events: ShotEvent[]; summary: string };

export type MatchProps = {
  gameId: number;
  shots: number;
  balls: Ball[];
  myTurn: boolean;
  ballInHand: boolean;
  active: boolean;
  prompt: string;
  replay: Replay | null;
};

type Clip = { frameMs: number; frames: Frame[]; events: ShotEvent[] };

function seenKey(gameId: number): string {
  return `jornal:bilhar:${gameId}`;
}

function seenShot(gameId: number): number {
  try {
    return Number(localStorage.getItem(seenKey(gameId)) ?? "0");
  } catch {
    return 0;
  }
}

function markSeen(gameId: number, n: number): void {
  try {
    localStorage.setItem(seenKey(gameId), String(n));
  } catch {}
}

function framePositions(clip: Clip, elapsed: number): [number, number][] {
  const last = clip.frames.length - 1;
  const raw = elapsed / clip.frameMs;
  const i = Math.min(last, Math.floor(raw));
  if (i >= last) return clip.frames[last].pos;
  const frac = raw - i;
  const a = clip.frames[i].pos;
  const b = clip.frames[i + 1].pos;
  return a.map(([x, y], k) => {
    const [nx, ny] = b[k];
    if (x < -50 || nx < -50) return nx < -50 ? [x, y] : [nx, ny];
    return [x + (nx - x) * frac, y + (ny - y) * frac];
  });
}

const COLORS: Record<number, string> = {
  0: "#fbf7ea",
  1: "#f2c230",
  2: "#1f4fbf",
  3: "#e10600",
  4: "#5b2a86",
  5: "#f27a1a",
  6: "#0f7a3d",
  7: "#7a1f1f",
  8: "#141414",
};

function ballColor(id: number): string {
  return COLORS[id > 8 ? id - 8 : id] ?? "#999";
}

type Phase = "aim" | "rolling" | "placing" | "waiting";

function restingPhase(match: MatchProps | undefined): Phase {
  if (!match) return "aim";
  if (!match.myTurn || !match.active) return "waiting";
  return match.ballInHand ? "placing" : "aim";
}
type View = { scale: number; vertical: boolean; dpr: number };

function toTable(view: View, px: number, py: number): { x: number; y: number } {
  const u = px / view.scale - RAIL;
  const v = py / view.scale - RAIL;
  return view.vertical ? { x: TABLE.width - (py / view.scale - RAIL), y: u } : { x: u, y: v };
}

function describe(result: ShotResult): string {
  const balls = result.pocketed.filter((id) => id !== 0);
  const scratch = result.pocketed.includes(0);
  const parts: string[] = [];
  if (result.firstContact === null) parts.push("A branca não tocou em nada.");
  if (balls.includes(8)) parts.push("🎱 Meteste a preta!");
  const others = balls.filter((id) => id !== 8);
  if (others.length > 0) parts.push(`Meteste ${others.length === 1 ? "a" : "as"} ${others.join(", ")}.`);
  if (scratch) parts.push("A branca foi ao buraco: põe-na onde quiseres.");
  if (parts.length === 0) parts.push("Nada entrou.");
  return parts.join(" ");
}

export function PoolTable({ match }: { match?: MatchProps }) {
  const router = useRouter();
  const wrap = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const view = useRef<View>({ scale: 1, vertical: false, dpr: 1 });
  const balls = useRef<Ball[]>(match ? match.balls : rack());
  const shown = useRef<[number, number][] | null>(null);
  const ghost = useRef<{ x: number; y: number } | null>(null);
  const placement = useRef<{ x: number; y: number } | null>(null);
  const dragging = useRef(false);
  const [phase, setPhase] = useState<Phase>(() => restingPhase(match));
  const [angle, setAngle] = useState(() => {
    const cue = match?.balls.find((b) => b.id === 0);
    if (!cue || !match) return 0;
    const near = match.balls
      .filter((b) => b.id !== 0 && b.id !== 8 && !b.pocketed)
      .sort((a, b) => Math.hypot(a.x - cue.x, a.y - cue.y) - Math.hypot(b.x - cue.x, b.y - cue.y))[0];
    return near ? Math.atan2(near.y - cue.y, near.x - cue.x) : 0;
  });
  const [power, setPower] = useState(0.55);
  const [message, setMessage] = useState(match ? match.prompt : "Abertura: aponta para o triângulo e dá-lhe com força.");
  const [potted, setPotted] = useState<number[]>([]);
  const [shots, setShots] = useState(0);
  const [height, setHeight] = useState(0);

  const draw = useCallback(() => {
    const c = canvas.current;
    const ctx = c?.getContext("2d");
    if (!c || !ctx) return;
    const { scale, vertical, dpr } = view.current;
    const s = scale * dpr;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, c.width, c.height);
    if (vertical) ctx.setTransform(0, -s, s, 0, RAIL * s, (TABLE.width + RAIL) * s);
    else ctx.setTransform(s, 0, 0, s, RAIL * s, RAIL * s);

    ctx.fillStyle = "#5a3214";
    ctx.beginPath();
    ctx.roundRect(-RAIL, -RAIL, FULL_W, FULL_H, 26);
    ctx.fill();
    ctx.fillStyle = "#0b6b3a";
    ctx.fillRect(0, 0, TABLE.width, TABLE.height);
    ctx.fillStyle = "#f2c230";
    for (let i = 1; i < 8; i++) {
      if (i === 4) continue;
      for (const y of [-RAIL / 2, TABLE.height + RAIL / 2]) {
        ctx.beginPath();
        ctx.arc((TABLE.width / 8) * i, y, 3.5, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    for (let i = 1; i < 4; i++) {
      for (const x of [-RAIL / 2, TABLE.width + RAIL / 2]) {
        ctx.beginPath();
        ctx.arc(x, (TABLE.height / 4) * i, 3.5, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    ctx.strokeStyle = "rgba(255,246,214,0.18)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(HEAD_SPOT.x, 0);
    ctx.lineTo(HEAD_SPOT.x, TABLE.height);
    ctx.stroke();
    ctx.fillStyle = "#050505";
    for (const p of POCKETS) {
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      ctx.fill();
    }

    const list = balls.current;
    const positions = shown.current ?? list.map((b) => (b.pocketed ? ([-100, -100] as [number, number]) : ([b.x, b.y] as [number, number])));
    const cue = list.findIndex((b) => b.id === 0);

    if (phase === "aim" && !shown.current && !list[cue].pocketed) {
      const guide = aimGuide(list, angle);
      const cb = list[cue];
      if (guide) {
        ctx.setLineDash([8, 8]);
        ctx.strokeStyle = "rgba(255,255,255,0.75)";
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(cb.x, cb.y);
        ctx.lineTo(guide.cueEnd.x, guide.cueEnd.y);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.beginPath();
        ctx.arc(guide.cueEnd.x, guide.cueEnd.y, BALL_R, 0, Math.PI * 2);
        ctx.stroke();
        if (guide.target) {
          ctx.strokeStyle = "rgba(242,194,48,0.9)";
          ctx.lineWidth = 3;
          ctx.beginPath();
          ctx.moveTo(guide.target.x, guide.target.y);
          ctx.lineTo(guide.target.x + guide.target.dirX * 70, guide.target.y + guide.target.dirY * 70);
          ctx.stroke();
        }
      }
      const back = BALL_R + 6 + power * 70;
      const dx = Math.cos(angle);
      const dy = Math.sin(angle);
      ctx.lineCap = "round";
      ctx.strokeStyle = "#d9a85b";
      ctx.lineWidth = 7;
      ctx.beginPath();
      ctx.moveTo(cb.x - dx * back, cb.y - dy * back);
      ctx.lineTo(cb.x - dx * (back + 330), cb.y - dy * (back + 330));
      ctx.stroke();
      ctx.strokeStyle = "#2a5fd1";
      ctx.beginPath();
      ctx.moveTo(cb.x - dx * back, cb.y - dy * back);
      ctx.lineTo(cb.x - dx * (back + 6), cb.y - dy * (back + 6));
      ctx.stroke();
      ctx.lineCap = "butt";
    }

    list.forEach((b, i) => {
      const [x, y] = positions[i];
      if (x < -50) return;
      ctx.fillStyle = "rgba(0,0,0,0.35)";
      ctx.beginPath();
      ctx.arc(x + 2.5, y + 2.5, BALL_R, 0, Math.PI * 2);
      ctx.fill();
      ctx.save();
      ctx.beginPath();
      ctx.arc(x, y, BALL_R, 0, Math.PI * 2);
      ctx.clip();
      ctx.fillStyle = isStripe(b.id) ? "#fbf7ea" : ballColor(b.id);
      ctx.fillRect(x - BALL_R, y - BALL_R, BALL_R * 2, BALL_R * 2);
      if (isStripe(b.id)) {
        ctx.fillStyle = ballColor(b.id);
        if (vertical) ctx.fillRect(x - BALL_R * 0.55, y - BALL_R, BALL_R * 1.1, BALL_R * 2);
        else ctx.fillRect(x - BALL_R, y - BALL_R * 0.55, BALL_R * 2, BALL_R * 1.1);
      }
      const shine = ctx.createRadialGradient(x - 4, y - 4, 1, x, y, BALL_R);
      shine.addColorStop(0, "rgba(255,255,255,0.55)");
      shine.addColorStop(0.35, "rgba(255,255,255,0)");
      shine.addColorStop(1, "rgba(0,0,0,0.3)");
      ctx.fillStyle = shine;
      ctx.fillRect(x - BALL_R, y - BALL_R, BALL_R * 2, BALL_R * 2);
      ctx.restore();
      if (b.id > 0) {
        ctx.fillStyle = "#fbf7ea";
        ctx.beginPath();
        ctx.arc(x, y, BALL_R * 0.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.save();
        ctx.translate(x, y);
        if (vertical) ctx.rotate(Math.PI / 2);
        ctx.fillStyle = "#141414";
        ctx.font = `bold ${b.id > 9 ? 8 : 9}px sans-serif`;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(String(b.id), 0, 0.5);
        ctx.restore();
      }
    });

    if (phase === "placing" && ghost.current) {
      const ok = canPlaceCue(list, ghost.current.x, ghost.current.y);
      ctx.globalAlpha = 0.7;
      ctx.fillStyle = ok ? "#fbf7ea" : "#e10600";
      ctx.beginPath();
      ctx.arc(ghost.current.x, ghost.current.y, BALL_R, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
    }
  }, [angle, phase, power]);

  useEffect(() => {
    const el = wrap.current;
    const c = canvas.current;
    if (!el || !c) return;
    const resize = () => {
      const vertical = el.clientWidth < 560;
      const room = Math.max(320, window.innerHeight - (vertical ? 270 : 230));
      const scale = Math.min(el.clientWidth / (vertical ? FULL_H : FULL_W), room / (vertical ? FULL_W : FULL_H));
      const width = (vertical ? FULL_H : FULL_W) * scale;
      const cssH = (vertical ? FULL_W : FULL_H) * scale;
      const dpr = window.devicePixelRatio || 1;
      view.current = { scale, vertical, dpr };
      c.width = Math.round(width * dpr);
      c.height = Math.round(cssH * dpr);
      c.style.width = `${width}px`;
      c.style.height = `${cssH}px`;
      setHeight(cssH);
      draw();
    };
    resize();
    const obs = new ResizeObserver(resize);
    obs.observe(el);
    return () => obs.disconnect();
  }, [draw]);

  useEffect(() => {
    draw();
  }, [draw]);

  function pointerTable(e: React.PointerEvent<HTMLCanvasElement>) {
    const rect = e.currentTarget.getBoundingClientRect();
    return toTable(view.current, e.clientX - rect.left, e.clientY - rect.top);
  }

  function aimAt(e: React.PointerEvent<HTMLCanvasElement>) {
    const cue = balls.current.find((b) => b.id === 0);
    if (!cue || cue.pocketed) return;
    const p = pointerTable(e);
    if (Math.hypot(p.x - cue.x, p.y - cue.y) < 2) return;
    setAngle(Math.atan2(p.y - cue.y, p.x - cue.x));
  }

  function onPointerDown(e: React.PointerEvent<HTMLCanvasElement>) {
    if (phase === "aim") {
      dragging.current = true;
      e.currentTarget.setPointerCapture(e.pointerId);
      aimAt(e);
    } else if (phase === "placing") {
      ghost.current = pointerTable(e);
      draw();
    }
  }

  function onPointerMove(e: React.PointerEvent<HTMLCanvasElement>) {
    if (phase === "aim" && dragging.current) aimAt(e);
    else if (phase === "placing") {
      ghost.current = pointerTable(e);
      draw();
    }
  }

  function onPointerUp(e: React.PointerEvent<HTMLCanvasElement>) {
    dragging.current = false;
    if (phase !== "placing") return;
    const p = pointerTable(e);
    if (!canPlaceCue(balls.current, p.x, p.y)) {
      setMessage("Aí não cabe. Põe a branca num sítio livre da mesa.");
      return;
    }
    balls.current = balls.current.map((b) => (b.id === 0 ? { ...b, x: p.x, y: p.y, pocketed: false } : b));
    placement.current = p;
    ghost.current = null;
    setPhase("aim");
    setMessage("Branca no sítio. A tua vez.");
  }

  const animate = useCallback(
    (clip: Clip, done: () => void) => {
      const duration = clip.frames[clip.frames.length - 1].t;
      const started = performance.now();
      let nextEvent = 0;
      let lastClack = -100;
      const tick = (now: number) => {
        const elapsed = Math.max(0, now - started);
        while (nextEvent < clip.events.length && clip.events[nextEvent].t <= elapsed) {
          const ev = clip.events[nextEvent++];
          if (ev.kind === "pocket") sons.pocket();
          else if (ev.t - lastClack > 35) {
            lastClack = ev.t;
            if (ev.kind === "hit") sons.clack(ev.speed / 2);
            else sons.rail(ev.speed / 2);
          }
        }
        shown.current = framePositions(clip, elapsed);
        draw();
        if (elapsed < duration) {
          requestAnimationFrame(tick);
          return;
        }
        shown.current = null;
        done();
      };
      requestAnimationFrame(tick);
    },
    [draw],
  );

  async function shoot() {
    if (phase !== "aim") return;
    sons.cue(power);
    setPhase("rolling");
    if (!match) {
      const result = simulate(balls.current, { angle, power });
      setShots((n) => n + 1);
      animate({ frameMs: FRAME_MS, frames: result.frames, events: result.events }, () => {
        balls.current = result.balls;
        setPotted((list) => [...list, ...result.pocketed.filter((id) => id !== 0)]);
        const left = result.balls.filter((b) => b.id !== 0 && !b.pocketed).length;
        setMessage(left === 0 ? "Mesa limpa! 🎉 Carrega em «Nova partida» para voltar a arrumar." : describe(result));
        if (result.pocketed.includes(0)) {
          balls.current = result.balls.map((b) => (b.id === 0 ? { ...b, x: HEAD_SPOT.x, y: HEAD_SPOT.y } : b));
          setPhase("placing");
        } else setPhase("aim");
      });
      return;
    }
    const res = await shootPool(match.gameId, match.shots, { angle, power }, match.ballInHand ? placement.current : null);
    if (!res.ok) {
      setMessage(res.error);
      setPhase(match.ballInHand && !placement.current ? "placing" : "aim");
      return;
    }
    markSeen(match.gameId, res.playback.n);
    animate(res.playback, () => {
      balls.current = res.playback.balls;
      setMessage(res.playback.summary);
      router.refresh();
    });
  }

  useEffect(() => {
    if (!match?.replay || match.replay.n <= seenShot(match.gameId)) return;
    const replay = match.replay;
    const final = balls.current;
    const id = requestAnimationFrame(() => {
      setPhase("rolling");
      setMessage("A ver a última tacada…");
      animate(replay, () => {
        markSeen(match.gameId, replay.n);
        balls.current = final;
        setPhase(restingPhase(match));
        setMessage(match.prompt);
      });
    });
    return () => cancelAnimationFrame(id);
  }, [animate, match]);

  useEffect(() => {
    if (!match?.active || phase !== "waiting") return;
    const timer = setInterval(() => {
      if (document.visibilityState === "visible") router.refresh();
    }, POLL_MS);
    return () => clearInterval(timer);
  }, [match?.active, phase, router]);

  function watchReplay() {
    if (!match?.replay || phase === "rolling") return;
    const replay = match.replay;
    const resting = phase;
    const final = balls.current;
    setPhase("rolling");
    animate(replay, () => {
      balls.current = final;
      setPhase(resting);
      draw();
    });
  }

  function reset() {
    balls.current = rack();
    shown.current = null;
    ghost.current = null;
    setPotted([]);
    setShots(0);
    setAngle(0);
    setPhase("aim");
    setMessage("Bolas arrumadas. Abertura!");
  }

  return (
    <div className="mx-auto max-w-3xl space-y-3">
      <div ref={wrap} className="w-full" style={{ minHeight: height }}>
        <canvas
          ref={canvas}
          className="mx-auto block touch-none select-none"
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={() => (dragging.current = false)}
          aria-label="Mesa de bilhar. Toca ou arrasta para apontar a tacada."
        />
      </div>

      <p className="min-h-6 text-center text-sm font-bold" aria-live="polite">{message}</p>

      {(!match || (match.active && match.myTurn)) && (
      <div className="mx-auto flex max-w-sm flex-col items-stretch gap-2">
        <label className="flex items-center gap-2 text-sm font-bold">
          Força
          <input type="range" min={5} max={100} value={Math.round(power * 100)} onChange={(e) => setPower(Number(e.target.value) / 100)}
            disabled={phase !== "aim"} className="min-w-0 flex-1 accent-[#f2c230]" />
          <span className="w-10 text-right tabular-nums">{Math.round(power * 100)}%</span>
        </label>
        <div className="flex items-center gap-2">
          <button type="button" onClick={() => setAngle((a) => a - FINE_STEP)} disabled={phase !== "aim"}
            className="border-2 border-[#141414] bg-[#fff6d6] px-4 py-2 font-black text-[#141414] disabled:opacity-40" aria-label="Rodar a mira um pouco para um lado">↺</button>
          <button type="button" onClick={shoot} disabled={phase !== "aim"}
            className="flex-1 border-4 border-[#141414] bg-[#e10600] py-2 font-display text-xl font-black uppercase text-[#f2c230] shadow-[4px_4px_0_#141414] active:translate-y-0.5 disabled:opacity-50">
            🎱 Tacar
          </button>
          <button type="button" onClick={() => setAngle((a) => a + FINE_STEP)} disabled={phase !== "aim"}
            className="border-2 border-[#141414] bg-[#fff6d6] px-4 py-2 font-black text-[#141414] disabled:opacity-40" aria-label="Rodar a mira um pouco para o outro lado">↻</button>
        </div>
      </div>
      )}

      {match ? (
        <div className="flex flex-wrap items-center justify-center gap-4 text-sm">
          {match.replay && (
            <button type="button" onClick={watchReplay} disabled={phase === "rolling"} className="underline disabled:opacity-40">
              ▶ Ver a última tacada
            </button>
          )}
          {match.ballInHand && match.myTurn && phase === "aim" && (
            <button type="button" onClick={() => setPhase("placing")} className="underline">
              Mudar a branca de sítio
            </button>
          )}
        </div>
      ) : (
        <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
          <span>
            Tacadas: <strong>{shots}</strong> · Metidas: {potted.length === 0 ? "nenhuma" : potted.map((id) => <BallChip key={id} id={id} />)}
          </span>
          <button type="button" onClick={reset} disabled={phase === "rolling"} className="underline disabled:opacity-40">Nova partida</button>
        </div>
      )}
    </div>
  );
}

export function BallChip({ id, faded = false }: { id: number; faded?: boolean }) {
  const dark = id === 8 || [2, 4, 7].includes(id > 8 ? id - 8 : id);
  return (
    <span
      className={`mx-0.5 inline-flex h-6 w-6 items-center justify-center rounded-full border border-[#141414] text-[10px] font-black ${faded ? "opacity-25" : ""}`}
      style={{
        background: isStripe(id) ? `linear-gradient(${ballColor(id)} 0 0) center / 100% 55% no-repeat, #fbf7ea` : ballColor(id),
        color: dark && !isStripe(id) ? "#fff" : "#141414",
      }}
    >
      {id}
    </span>
  );
}
