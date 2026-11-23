import "server-only";
import { randomInt } from "node:crypto";
import { SCRATCH_COST, SCRATCH_FILLERS, SCRATCH_ODDS_BASE, SCRATCH_PRIZES } from "./scratch-table";

const ALL_SYMBOLS = [...SCRATCH_PRIZES.map((p) => p.emoji), ...SCRATCH_FILLERS];

function pick<T>(items: readonly T[]): T {
  return items[randomInt(items.length)];
}

function shuffle<T>(items: T[]): T[] {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = randomInt(i + 1);
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

function fillers(count: number, exclude: string | null): string[] {
  const counts = new Map<string, number>();
  const out: string[] = [];
  while (out.length < count) {
    const s = pick(ALL_SYMBOLS);
    if (s === exclude || (counts.get(s) ?? 0) >= 2) continue;
    counts.set(s, (counts.get(s) ?? 0) + 1);
    out.push(s);
  }
  return out;
}

export function drawTicket(): { cells: string[]; prize: number } {
  let roll = randomInt(SCRATCH_ODDS_BASE);
  for (const p of SCRATCH_PRIZES) {
    if (roll < p.chances) {
      return { cells: shuffle([p.emoji, p.emoji, p.emoji, ...fillers(3, p.emoji)]), prize: SCRATCH_COST * p.multiplier };
    }
    roll -= p.chances;
  }
  return { cells: shuffle(fillers(6, null)), prize: 0 };
}
