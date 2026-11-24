export const SCRATCH_ODDS_BASE = 3000;

export type ScratchPrize = { emoji: string; multiplier: number; chances: number };

export const SCRATCH_PRIZES: readonly ScratchPrize[] = [
  { emoji: "☕", multiplier: 50, chances: 6 },
  { emoji: "👑", multiplier: 10, chances: 30 },
  { emoji: "🥧", multiplier: 5, chances: 120 },
  { emoji: "🦆", multiplier: 2, chances: 300 },
  { emoji: "🫘", multiplier: 1, chances: 500 },
];

export const SCRATCH_FILLERS = ["🍺", "🐟", "🐕"] as const;

export function scratchReturn(): number {
  return SCRATCH_PRIZES.reduce((sum, p) => sum + p.chances * p.multiplier, 0) / SCRATCH_ODDS_BASE;
}

export function scratchWinChance(): number {
  return SCRATCH_PRIZES.reduce((sum, p) => sum + p.chances, 0) / SCRATCH_ODDS_BASE;
}

export function winningSymbol(cells: readonly string[]): string | null {
  const counts = new Map<string, number>();
  for (const c of cells) counts.set(c, (counts.get(c) ?? 0) + 1);
  for (const [s, n] of counts) if (n >= 3) return s;
  return null;
}
