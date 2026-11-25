"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { SLOT_SYMBOLS } from "@/lib/slot-table";
import { sons } from "@/lib/sons";
import { spinSlot } from "../slot-actions";

const LOSSES = [
  "A casa agradece.",
  "Quase! (Não.)",
  "O tremoço não estava do teu lado.",
  "Os grãos foram para o Cofre. O Tesoureiro sorri.",
  "Nada. Nem um pastel de nata.",
  "A máquina está quente. Tenta outra vez (diz a máquina).",
];

type Message = { text: string; tone: "win" | "even" | "loss" | "error" };

function randomSymbol(): string {
  return SLOT_SYMBOLS[Math.floor(Math.random() * SLOT_SYMBOLS.length)].emoji;
}

export function SlotMachine({ initialBalance, bets }: { initialBalance: number; bets: number[] }) {
  const router = useRouter();
  const [reels, setReels] = useState<string[]>(["☕", "☕", "☕"]);
  const [bet, setBet] = useState(bets[0]);
  const [balance, setBalance] = useState(initialBalance);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<Message | null>(null);
  const spinning = useRef([false, false, false]);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => () => {
    if (timer.current) clearInterval(timer.current);
  }, []);

  async function pull() {
    if (busy) return;
    setBusy(true);
    setMessage(null);
    sons.lever();
    spinning.current = [true, true, true];
    timer.current = setInterval(() => {
      const turning = spinning.current.filter(Boolean).length;
      if (turning > 0) sons.reelTick(turning);
      setReels((current) => current.map((s, i) => (spinning.current[i] ? randomSymbol() : s)));
    }, 70);

    const started = Date.now();
    const result = await spinSlot(bet).catch(() => null);
    const wait = Math.max(0, 600 - (Date.now() - started));

    const finish = (msg: Message) => {
      if (timer.current) clearInterval(timer.current);
      timer.current = null;
      setMessage(msg);
      setBusy(false);
      router.refresh();
    };

    if (!result || !result.ok) {
      spinning.current = [false, false, false];
      finish({ text: result?.error ?? "A máquina encravou. Tenta outra vez.", tone: "error" });
      return;
    }

    result.reels.forEach((symbol, i) => {
      setTimeout(() => {
        spinning.current[i] = false;
        setReels((current) => current.map((s, j) => (j === i ? symbol : s)));
        sons.reelStop(i);
        if (i === 2) {
          setBalance(result.balance);
          if (result.reels.every((s) => s === "☕")) {
            setTimeout(sons.jackpot, 150);
            finish({ text: `☕☕☕ JACKPOT! Ganhaste ${result.payout} ☕!`, tone: "win" });
          } else if (result.payout > result.bet) {
            setTimeout(() => sons.win(result.payout / result.bet), 150);
            finish({ text: `🎉 Ganhaste ${result.payout} ☕!`, tone: "win" });
          } else if (result.payout === result.bet) {
            setTimeout(sons.coin, 150);
            finish({ text: "Par: recuperas a aposta.", tone: "even" });
          } else {
            setTimeout(sons.lose, 150);
            finish({ text: LOSSES[Math.floor(Math.random() * LOSSES.length)], tone: "loss" });
          }
        }
      }, wait + 350 * (i + 1));
    });
  }

  const tone = {
    win: "bg-[#f2c230] text-[#141414] animate-bounce",
    even: "bg-white text-[#141414]",
    loss: "bg-[#141414] text-[#fff6d6]",
    error: "bg-white text-scoop",
  };

  return (
    <div className="mx-auto max-w-sm">
      <div className="rounded-t-[3rem] border-4 border-[#141414] bg-[#e10600] p-4 shadow-[6px_6px_0_#141414]">
        <div className="mb-3 border-[5px] border-dotted border-[#f2c230] bg-[#141414] py-2 text-center">
          <p className="font-display text-3xl font-black uppercase text-[#f2c230] [text-shadow:2px_2px_0_#e10600]">Jackpot</p>
          <p className="text-xs font-bold uppercase tracking-widest text-[#fff6d6]">☕☕☕ paga ×100</p>
        </div>
        <div className="flex justify-center gap-2 border-4 border-[#141414] bg-[#141414] p-2" aria-live="polite" aria-label={`Rolos: ${reels.join(" ")}`}>
          {reels.map((s, i) => (
            <div key={i} className="flex h-24 w-20 items-center justify-center border-2 border-[#f2c230] bg-[#fff6d6] text-5xl">
              <span>{s}</span>
            </div>
          ))}
        </div>
        <div className="mt-3 flex items-center justify-between gap-2">
          <div className="flex gap-1" role="group" aria-label="Aposta">
            {bets.map((b) => (
              <button
                key={b}
                type="button"
                disabled={busy}
                onClick={() => setBet(b)}
                aria-pressed={bet === b}
                className={`h-11 w-11 rounded-full border-4 border-dashed border-white text-sm font-black ${
                  bet === b ? "bg-[#141414] text-[#f2c230] outline outline-2 outline-[#f2c230]" : "bg-[#0b6b3a] text-white"
                }`}
              >
                {b}
              </button>
            ))}
          </div>
          <p className="text-right text-xs font-bold text-white">
            Saldo
            <span className="block font-display text-2xl font-black">{balance} ☕</span>
          </p>
        </div>
      </div>
      <div className="border-4 border-t-0 border-[#141414] bg-[#141414] p-3 shadow-[6px_6px_0_#141414]">
        <button
          type="button"
          onClick={pull}
          disabled={busy}
          className="w-full border-4 border-[#f2c230] bg-[#0b6b3a] py-3 font-display text-2xl font-black uppercase text-[#f2c230] active:translate-y-1 disabled:opacity-60"
        >
          {busy ? "A rodar…" : `Puxar a alavanca (${bet} ☕)`}
        </button>
      </div>
      <div className="mt-4 min-h-12 text-center">
        {message && <p className={`inline-block border-2 border-[#141414] px-3 py-2 font-bold ${tone[message.tone]}`}>{message.text}</p>}
      </div>
    </div>
  );
}
