import "server-only";
import { sql } from "./db";
import { DUEL_EXPIRY_HOURS } from "./duels-table";

export type ExpiredDuel = { id: number; challenger_id: number; stake: number; opponent: string };

export async function expireDuels(): Promise<ExpiredDuel[]> {
  return (await sql`
    WITH d AS (
      UPDATE duels SET status = 'expired', resolved_at = now()
      WHERE status = 'pending' AND created_at < now() - make_interval(hours => ${DUEL_EXPIRY_HOURS})
      RETURNING id, challenger_id, opponent_id, stake
    ),
    r AS (
      INSERT INTO ledger (user_id, amount, reason)
      SELECT challenger_id, stake, 'Duelo n.º ' || id || ': expirou, devolução' FROM d
    )
    SELECT d.id, d.challenger_id, d.stake, u.name AS opponent FROM d JOIN users u ON u.id = d.opponent_id
  `) as ExpiredDuel[];
}

export type DuelRow = {
  id: number;
  challenger_id: number;
  challenger: string;
  opponent_id: number;
  opponent: string;
  stake: number;
  challenger_move: string;
  opponent_move: string | null;
  status: "pending" | "done" | "declined" | "expired" | "cancelled";
  winner_id: number | null;
  created_at: Date;
  resolved_at: Date | null;
};

export async function duelsFor(userId: number): Promise<{ incoming: DuelRow[]; outgoing: DuelRow[]; arena: DuelRow[] }> {
  const rows = (await sql`
    SELECT d.id, d.challenger_id, c.name AS challenger, d.opponent_id, o.name AS opponent, d.stake,
      d.challenger_move, d.opponent_move, d.status, d.winner_id, d.created_at, d.resolved_at
    FROM duels d JOIN users c ON c.id = d.challenger_id JOIN users o ON o.id = d.opponent_id
    WHERE d.status = 'pending' AND (d.challenger_id = ${userId} OR d.opponent_id = ${userId})
       OR d.id IN (SELECT id FROM duels WHERE status = 'done' ORDER BY resolved_at DESC LIMIT 15)
    ORDER BY coalesce(d.resolved_at, d.created_at) DESC
  `) as DuelRow[];
  return {
    incoming: rows
      .filter((d) => d.status === "pending" && d.opponent_id === userId)
      .map((d) => ({ ...d, challenger_move: "" })),
    outgoing: rows.filter((d) => d.status === "pending" && d.challenger_id === userId),
    arena: rows.filter((d) => d.status === "done"),
  };
}
