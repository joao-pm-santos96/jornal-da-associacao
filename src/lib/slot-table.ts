export type SlotSymbol = { emoji: string; name: string; weight: number; triple: number; pair: number };

export const SLOT_SYMBOLS: readonly SlotSymbol[] = [
  { emoji: "🫘", name: "Tremoço", weight: 8, triple: 5, pair: 1 },
  { emoji: "🍺", name: "Imperial", weight: 7, triple: 8, pair: 1 },
  { emoji: "🦆", name: "Pato", weight: 6, triple: 10, pair: 1 },
  { emoji: "🐕", name: "Cão", weight: 5, triple: 15, pair: 2 },
  { emoji: "🐟", name: "Bacalhau", weight: 4, triple: 20, pair: 2 },
  { emoji: "🥧", name: "Pastel de nata", weight: 3, triple: 30, pair: 3 },
  { emoji: "👑", name: "Coroa", weight: 2, triple: 50, pair: 3 },
  { emoji: "☕", name: "Café", weight: 2, triple: 100, pair: 5 },
];

export const TOTAL_WEIGHT = SLOT_SYMBOLS.reduce((sum, s) => sum + s.weight, 0);

function symbol(emoji: string | undefined): SlotSymbol | undefined {
  return SLOT_SYMBOLS.find((s) => s.emoji === emoji);
}

export function multiplier(reels: readonly string[]): number {
  const [a, b, c] = reels;
  if (a === b && b === c) return symbol(a)?.triple ?? 0;
  const paired = a === b || a === c ? a : b === c ? b : undefined;
  return symbol(paired)?.pair ?? 0;
}

export function expectedReturn(): number {
  const p = (s: SlotSymbol) => s.weight / TOTAL_WEIGHT;
  return SLOT_SYMBOLS.reduce((sum, s) => sum + p(s) ** 3 * s.triple + 3 * p(s) ** 2 * (1 - p(s)) * s.pair, 0);
}
