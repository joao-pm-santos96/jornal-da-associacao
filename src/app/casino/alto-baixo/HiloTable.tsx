"use client";

import { useState, useTransition } from "react";
import { sons } from "@/lib/sons";
import { RANKS, hiloPayout, rank, stepMultiplier, suit, type Guess } from "@/lib/hilo";
import type { HiloState } from "@/lib/hilo-games";
import { cashHilo, guessHilo, startHilo, type HiloResult } from "./actions";

const RED = new Set(["♥", "♦"]);

function Card({ card, size = "big", fresh = false }: { card: number; size?: "big" | "small"; fresh?: boolean }) {
  const s = suit(card);
  const color = RED.has(s) ? "text-[#e10600]" : "text-[#141414]";
  const r = RANKS[rank(card) - 1];
  if (size === "small") {
    return (
      <span className={`inline-flex h-12 w-9 flex-col items-center justify-center rounded border-2 border-[#141414] bg-white text-xs font-black leading-none ${color}`}>
        {r}
        <span>{s}</span>
      </span>
    );
  }
  return (
    <div
      className={`relative flex h-48 w-34 flex-col justify-between rounded-lg border-4 border-[#141414] bg-white p-2 shadow-[6px_6px_0_#141414] ${color} ${fresh ? "hilo-card-in" : ""}`}
      aria-label={`${r} de ${s}`}
    >
      <span className="text-left text-2xl font-black leading-none">{r}<br />{s}</span>
      <span className="text-center text-6xl leading-none">{s}</span>
      <span className="rotate-180 text-left text-2xl font-black leading-none">{r}<br />{s}</span>
    </div>
  );
}

export function HiloTable({
  initialGame,
  initialBalance,
  minBet,
  maxBet,
  edgePct,
  maxMult,
}: {
  initialGame: HiloState | null;
  initialBalance: number;
  minBet: number;
  maxBet: number;
  edgePct: number;
  maxMult: number;
}) {
  const [game, setGame] = useState<HiloState | null>(initialGame);
  const [balance, setBalance] = useState(initialBalance);
  const [stake, setStake] = useState(Math.min(Math.max(minBet, 2), maxBet));
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const active = game?.status === "active";
  const current = game ? game.cards[game.cards.length - 1] : null;
  const history = game ? game.cards.slice(0, -1) : [];
  const correct = game ? game.cards.length - 1 - (game.status === "lost" ? 1 : 0) : 0;
  const potential = game ? hiloPayout(game.stake, game.multiplier) : 0;

  function apply(res: HiloResult, sound: (g: HiloState, prev: HiloState | null) => void): void {
    if (!res.ok) {
      setError(res.error);
      return;
    }
    setError(null);
    sound(res.game, game);
    setGame(res.game);
    setBalance(res.balance);
  }

  function deal(): void {
    sons.unlock();
    start(async () => apply(await startHilo(stake), () => sons.swoosh()));
  }

  function guess(g: Guess): void {
    if (!game) return;
    start(async () =>
      apply(await guessHilo(game.id, g), (next) => {
        if (next.status === "lost") sons.lose();
        else if (next.status === "cashed") sons.jackpot();
        else sons.coin();
      }),
    );
  }

  function cash(): void {
    if (!game) return;
    start(async () => apply(await cashHilo(game.id), (next) => sons.win(Math.max(2, Math.round(next.multiplier)))));
  }

  const options: { g: Guess; label: string }[] = [
    { g: "alto", label: "▲ Alto" },
    { g: "baixo", label: "▼ Baixo" },
  ];

  return (
    <div className="mx-auto max-w-md space-y-4">
      <p className="text-center text-sm font-bold">Tens <span className="text-[#f2c230]">{balance} ☕</span></p>

      <div className="flex min-h-56 items-center justify-center gap-4 border-4 border-double border-[#f2c230] bg-[#08502b] p-4">
        {current === null ? (
          <div className="flex h-48 w-34 items-center justify-center rounded-lg border-4 border-[#141414] bg-[#e10600] text-5xl shadow-[6px_6px_0_#141414] [background-image:repeating-linear-gradient(45deg,#e10600_0_8px,#b80500_8px_16px)]">
            🃏
          </div>
        ) : (
          <Card key={game?.cards.length ?? 0} card={current} fresh={game !== null && game.cards.length > 1} />
        )}
        {game && (
          <div className="space-y-1 text-center">
            <p className="text-xs font-black uppercase tracking-widest opacity-80">Multiplicador</p>
            <p className="font-display text-4xl font-black text-[#f2c230]">×{game.multiplier.toFixed(2).replace(".", ",")}</p>
            <p className="text-sm font-bold">
              {game.status === "lost" ? "Perdeste a aposta" : game.status === "cashed" ? `Levaste ${game.payout} ☕` : `Vale ${potential} ☕`}
            </p>
            <p className="text-xs opacity-80">{correct} {correct === 1 ? "acerto" : "acertos"} · aposta {game.stake} ☕</p>
          </div>
        )}
      </div>

      {history.length > 0 && (
        <div className="flex flex-wrap justify-center gap-1" aria-label="Cartas anteriores">
          {history.map((c, i) => <Card key={i} card={c} size="small" />)}
        </div>
      )}

      {error && <p className="border-2 border-[#e10600] bg-white p-2 text-sm font-semibold text-[#e10600]">{error}</p>}

      {active && current !== null ? (
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            {options.map(({ g, label }) => {
              const m = stepMultiplier(current, g, edgePct);
              return (
                <button
                  key={g}
                  type="button"
                  disabled={pending || m === 0}
                  onClick={() => guess(g)}
                  className="border-4 border-[#141414] bg-[#e10600] px-3 py-3 font-display text-2xl font-black uppercase text-[#f2c230] shadow-[4px_4px_0_#141414] disabled:opacity-40"
                >
                  {label}
                  <span className="block text-sm text-white">{m === 0 ? "impossível" : `×${m.toFixed(2).replace(".", ",")}`}</span>
                </button>
              );
            })}
          </div>
          <button
            type="button"
            disabled={pending || game.cards.length < 2}
            onClick={cash}
            className="w-full border-4 border-[#141414] bg-[#f2c230] px-3 py-2 font-display text-xl font-black uppercase text-[#141414] shadow-[4px_4px_0_#141414] disabled:opacity-40"
          >
            💰 Recolher {potential} ☕
          </button>
          <p className="text-center text-xs opacity-80">
            {game.cards.length < 2 ? "Acerta pelo menos uma carta para poderes recolher." : "Uma carta igual conta como errada."} Ao chegar a ×{maxMult} recolhes sozinho.
          </p>
        </div>
      ) : (
        <div className="flex flex-wrap items-end justify-center gap-3">
          <div>
            <label htmlFor="hilo-stake" className="block text-xs font-semibold">Aposta ({minBet} a {maxBet} ☕)</label>
            <input
              id="hilo-stake"
              type="number"
              min={minBet}
              max={maxBet}
              step={1}
              value={stake}
              onChange={(e) => setStake(Number(e.target.value))}
              className="w-24 border-2 border-[#141414] bg-[#fff6d6] p-1.5 text-[#141414]"
            />
          </div>
          <button
            type="button"
            disabled={pending}
            onClick={deal}
            className="border-4 border-[#141414] bg-[#e10600] px-5 py-1.5 font-display text-xl font-black uppercase text-[#f2c230] shadow-[4px_4px_0_#141414] disabled:opacity-50"
          >
            🃏 {game ? "Nova mão" : "Dar cartas"}
          </button>
        </div>
      )}
    </div>
  );
}
