export type SlotSymbol = { emoji: string; name: string };
export type SlotPay = SlotSymbol & { weight: number; triple: number; pair: number };

export const SLOT_SYMBOLS: readonly SlotSymbol[] = [
  { emoji: "🫘", name: "Tremoço" },
  { emoji: "🍺", name: "Imperial" },
  { emoji: "🦆", name: "Pato" },
  { emoji: "🐕", name: "Cão" },
  { emoji: "🐟", name: "Bacalhau" },
  { emoji: "🥧", name: "Pastel de nata" },
  { emoji: "👑", name: "Coroa" },
  { emoji: "☕", name: "Café" },
];

export function totalWeight(pays: readonly SlotPay[]): number {
  return pays.reduce((sum, s) => sum + s.weight, 0);
}

export function multiplier(reels: readonly string[], pays: readonly SlotPay[]): number {
  const [a, b, c] = reels;
  const find = (emoji: string | undefined) => pays.find((s) => s.emoji === emoji);
  if (a === b && b === c) return find(a)?.triple ?? 0;
  const paired = a === b || a === c ? a : b === c ? b : undefined;
  return find(paired)?.pair ?? 0;
}

export function expectedReturn(pays: readonly SlotPay[]): number {
  const total = totalWeight(pays);
  if (total <= 0) return 0;
  return pays.reduce((sum, s) => {
    const p = s.weight / total;
    return sum + p ** 3 * s.triple + 3 * p ** 2 * (1 - p) * s.pair;
  }, 0);
}
