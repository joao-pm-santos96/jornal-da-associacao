"use client";

import { useEffect, useState } from "react";
import { sons } from "@/lib/sons";
import { seenShot } from "./PoolTable";

const COLORS = ["#e10600", "#f2c230", "#1f4fbf", "#0f7a3d", "#fbf7ea", "#f27a1a", "#5b2a86"];
const PIECES = 90;
const SHOW_MS = 8000;

function festaKey(gameId: number): string {
  return `jornal:bilhar:${gameId}:festa`;
}

function alreadyCelebrated(gameId: number): boolean {
  try {
    return localStorage.getItem(festaKey(gameId)) !== null;
  } catch {
    return true;
  }
}

function markCelebrated(gameId: number): void {
  try {
    localStorage.setItem(festaKey(gameId), "1");
  } catch {}
}

export function Celebration({ gameId, finalShot, winner, line }: { gameId: number; finalShot: number; winner: string; line: string }) {
  const [show, setShow] = useState(false);

  useEffect(() => {
    if (alreadyCelebrated(gameId)) return;
    const timer = setInterval(() => {
      if (seenShot(gameId) < finalShot) return;
      clearInterval(timer);
      markCelebrated(gameId);
      setShow(true);
      sons.victory();
    }, 300);
    return () => clearInterval(timer);
  }, [gameId, finalShot]);

  useEffect(() => {
    if (!show) return;
    const timer = setTimeout(() => setShow(false), SHOW_MS);
    return () => clearTimeout(timer);
  }, [show]);

  if (!show) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center overflow-hidden bg-[#141414]/40" onClick={() => setShow(false)} role="dialog" aria-label={`${winner} ganhou a partida`}>
      <div aria-hidden="true" className="pointer-events-none absolute inset-0">
        {Array.from({ length: PIECES }, (_, i) => (
          <span
            key={i}
            className="jornal-confetti"
            style={{
              left: `${(i * 37 + 7) % 100}%`,
              background: COLORS[i % COLORS.length],
              animationDuration: `${2.6 + ((i * 7) % 20) / 10}s`,
              animationDelay: `${((i * 13) % 15) / 10}s`,
              borderRadius: i % 3 === 0 ? "50%" : "2px",
              ["--drift" as string]: `${((i * 29) % 160) - 80}px`,
            }}
          />
        ))}
      </div>
      <div className="relative mx-4 border-4 border-[#141414] bg-[#f2c230] px-6 py-5 text-center text-[#141414] shadow-[6px_6px_0_#141414]">
        <p className="text-5xl" aria-hidden="true">🏆</p>
        <p className="font-display text-3xl font-black">{winner} ganhou!</p>
        <p className="mt-1 text-sm font-bold">{line}</p>
        <p className="mt-3 text-xs uppercase tracking-widest opacity-70">Toca para fechar</p>
      </div>
    </div>
  );
}
