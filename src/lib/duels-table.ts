
export type Move = "pedra" | "papel" | "tesoura";

export const MOVES: readonly { move: Move; emoji: string; label: string }[] = [
  { move: "pedra", emoji: "🪨", label: "Pedra" },
  { move: "papel", emoji: "📄", label: "Papel" },
  { move: "tesoura", emoji: "✂️", label: "Tesoura" },
];

const BEATS: Record<Move, Move> = { pedra: "tesoura", papel: "pedra", tesoura: "papel" };

export function isMove(value: string): value is Move {
  return value === "pedra" || value === "papel" || value === "tesoura";
}

export function outcome(challenger: Move, opponent: Move): "challenger" | "opponent" | "tie" {
  if (challenger === opponent) return "tie";
  return BEATS[challenger] === opponent ? "challenger" : "opponent";
}

export function duelPrize(stake: number, cutPct: number): number {
  const pot = stake * 2;
  return pot - Math.ceil((pot * cutPct) / 100);
}

export function moveEmoji(move: string | null): string {
  return MOVES.find((m) => m.move === move)?.emoji ?? "❔";
}
