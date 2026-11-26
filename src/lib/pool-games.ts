import "server-only";
import { sql } from "./db";
import { getRules } from "./rules";
import type { Frame, ShotEvent } from "./pool";
import type { PoolState } from "./pool-rules";

export type PoolStatus = "pending" | "active" | "finished" | "declined" | "cancelled" | "expired";

export type LastShot = { n: number; by: number; frameMs: number; frames: Frame[]; events: ShotEvent[]; summary: string };

export type PoolGameSummary = {
  id: number;
  challenger_id: number;
  challenger: string;
  opponent_id: number;
  opponent: string;
  stake: number;
  status: PoolStatus;
  turn_id: number | null;
  shots: number;
  winner_id: number | null;
  finish_reason: string | null;
  deadline_at: Date | null;
  created_at: Date;
  finished_at: Date | null;
};

export type PoolGame = PoolGameSummary & { state: PoolState | null; last_shot: LastShot | null };

export const FINISH_LABEL: Record<string, string> = {
  preta: "na preta",
  desistencia: "por desistência",
  tempo: "por falta de comparência",
};

export function poolPrize(stake: number, cutPct: number): number {
  const pot = stake * 2;
  return pot - Math.ceil((pot * cutPct) / 100);
}

const SUMMARY = `
  g.id, g.challenger_id, member_label(g.challenger_id) AS challenger, g.opponent_id, member_label(g.opponent_id) AS opponent,
  g.stake, g.status, g.turn_id, g.shots, g.winner_id, g.finish_reason, g.deadline_at, g.created_at, g.finished_at
`;

export async function listPoolGames(): Promise<PoolGameSummary[]> {
  return (await sql.query(`
    SELECT ${SUMMARY} FROM pool_games g
    WHERE g.status IN ('pending', 'active')
       OR g.id IN (SELECT id FROM pool_games WHERE status = 'finished' ORDER BY finished_at DESC LIMIT 15)
    ORDER BY g.status = 'active' DESC, g.status = 'pending' DESC, coalesce(g.finished_at, g.updated_at) DESC
  `)) as PoolGameSummary[];
}

export async function getPoolGame(id: number): Promise<PoolGame | null> {
  const [row] = (await sql.query(`SELECT ${SUMMARY}, g.state, g.last_shot FROM pool_games g WHERE g.id = $1`, [id])) as PoolGame[];
  return row ?? null;
}

export type ExpiredPool = { id: number; challenger_id: number; opponent_id: number; stake: number };
export type TimedOutPool = { id: number; winner_id: number; loser_id: number; prize: number };

export async function settlePoolGames(): Promise<{ expired: ExpiredPool[]; timedOut: TimedOutPool[] }> {
  const R = await getRules();
  const [expired, timedOut] = await Promise.all([
    sql`
      WITH g AS (
        UPDATE pool_games SET status = 'expired', updated_at = now(), finished_at = now()
        WHERE status = 'pending' AND created_at < now() - make_interval(hours => ${R.poolAcceptHours})
        RETURNING id, challenger_id, opponent_id, stake
      ),
      r AS (
        INSERT INTO ledger (user_id, amount, reason)
        SELECT challenger_id, stake, 'Bilhar n.º ' || id || ': desafio expirou, devolução' FROM g WHERE stake > 0
      )
      SELECT id, challenger_id, opponent_id, stake FROM g
    `,
    sql`
      WITH g AS (
        UPDATE pool_games
        SET status = 'finished', finish_reason = 'tempo', finished_at = now(), updated_at = now(), deadline_at = NULL,
          winner_id = CASE WHEN turn_id = challenger_id THEN opponent_id ELSE challenger_id END
        WHERE status = 'active' AND deadline_at < now()
        RETURNING id, winner_id, turn_id AS loser_id, stake
      ),
      p AS (
        INSERT INTO ledger (user_id, amount, reason)
        SELECT winner_id, (stake * 2 - ceil(stake * 2 * ${R.poolHouseCutPct}::numeric / 100))::int,
          'Bilhar n.º ' || id || ': vitória por falta de comparência'
        FROM g WHERE stake > 0
      )
      SELECT id, winner_id, loser_id, (stake * 2 - ceil(stake * 2 * ${R.poolHouseCutPct}::numeric / 100))::int AS prize FROM g
    `,
  ]);
  return { expired: expired as ExpiredPool[], timedOut: timedOut as TimedOutPool[] };
}
