export type Guess = "alto" | "baixo";

export const RANKS = ["A", "2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K"] as const;
export const SUITS = ["♠", "♥", "♦", "♣"] as const;
export const DECK_SIZE = 52;

export function rank(card: number): number {
  return (card % 13) + 1;
}

export function suit(card: number): (typeof SUITS)[number] {
  return SUITS[Math.floor(card / 13) % 4];
}

export function label(card: number): string {
  return `${RANKS[rank(card) - 1]}${suit(card)}`;
}

export function winChance(current: number, guess: Guess): number {
  const r = rank(current);
  return guess === "alto" ? (13 - r) / 13 : (r - 1) / 13;
}

export function stepMultiplier(current: number, guess: Guess, edgePct: number): number {
  const p = winChance(current, guess);
  if (p === 0) return 0;
  return Math.floor(((1 - edgePct / 100) / p) * 100) / 100;
}

export function beats(current: number, next: number, guess: Guess): boolean {
  return guess === "alto" ? rank(next) > rank(current) : rank(next) < rank(current);
}

export function compound(multiplier: number, step: number): number {
  return Math.floor(multiplier * step * 100) / 100;
}

export function hiloPayout(stake: number, multiplier: number): number {
  return Math.round(stake * multiplier);
}
