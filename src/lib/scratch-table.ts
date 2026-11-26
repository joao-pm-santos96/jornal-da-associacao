export const SCRATCH_ODDS_BASE = 3000;

export type ScratchSymbol = { emoji: string; name: string };
export type ScratchPrize = ScratchSymbol & { multiplier: number; chances: number };

export const SCRATCH_SYMBOLS: readonly ScratchSymbol[] = [
  { emoji: "☕", name: "Café" },
  { emoji: "👑", name: "Coroa" },
  { emoji: "🥧", name: "Pastel de nata" },
  { emoji: "🦆", name: "Pato" },
  { emoji: "🫘", name: "Tremoço" },
];

export const SCRATCH_FILLERS = ["🍺", "🐟", "🐕"] as const;

export function scratchReturn(prizes: readonly ScratchPrize[]): number {
  return prizes.reduce((sum, p) => sum + p.chances * p.multiplier, 0) / SCRATCH_ODDS_BASE;
}

export function scratchWinChance(prizes: readonly ScratchPrize[]): number {
  return prizes.reduce((sum, p) => sum + p.chances, 0) / SCRATCH_ODDS_BASE;
}

export function winningSymbol(cells: readonly string[]): string | null {
  const counts = new Map<string, number>();
  for (const c of cells) counts.set(c, (counts.get(c) ?? 0) + 1);
  for (const [s, n] of counts) if (n >= 3) return s;
  return null;
}
