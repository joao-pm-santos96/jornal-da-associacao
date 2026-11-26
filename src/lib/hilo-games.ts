import "server-only";
import { sql } from "./db";

export type HiloState = { id: number; stake: number; cards: number[]; multiplier: number; status: "active" | "lost" | "cashed"; payout: number };
export type HiloRow = Omit<HiloState, "multiplier"> & { multiplier: string };

export function toState(r: HiloRow): HiloState {
  return { ...r, multiplier: Number(r.multiplier) };
}

export async function activeHilo(userId: number): Promise<HiloState | null> {
  const [row] = (await sql`
    SELECT id, stake, cards, multiplier, status, payout FROM hilo_games WHERE user_id = ${userId} AND status = 'active'
  `) as HiloRow[];
  return row ? toState(row) : null;
}

