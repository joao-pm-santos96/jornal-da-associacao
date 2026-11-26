import "server-only";
import { sql } from "./db";
import { getRules } from "./rules";

export type ReflexStatus = "pending" | "active" | "finished" | "declined" | "cancelled" | "expired";

export type ReflexGame = {
  id: number;
  challenger_id: number;
  challenger: string;
  opponent_id: number;
  opponent: string;
  stake: number;
  status: ReflexStatus;
  turn_id: number | null;
  challenger_times: number[];
  opponent_times: number[];
  attempt_open: boolean;
  winner_id: number | null;
  finish_reason: string | null;
  deadline_at: Date | null;
  created_at: Date;
  finished_at: Date | null;
};

export const REFLEX_FINISH_LABEL: Record<string, string> = {
  tempo: "por falta de comparência",
  empate: "empate",
};

const COLUMNS = `
  g.id, g.challenger_id, member_label(g.challenger_id) AS challenger, g.opponent_id, member_label(g.opponent_id) AS opponent,
  g.stake, g.status, g.turn_id, g.challenger_times, g.opponent_times, g.attempt_issued_at IS NOT NULL AS attempt_open,
  g.winner_id, g.finish_reason, g.deadline_at, g.created_at, g.finished_at
`;

export async function listReflexGames(): Promise<ReflexGame[]> {
  return (await sql.query(`
    SELECT ${COLUMNS} FROM reflex_games g
    WHERE g.status IN ('pending', 'active')
       OR g.id IN (SELECT id FROM reflex_games WHERE status = 'finished' ORDER BY finished_at DESC LIMIT 15)
    ORDER BY g.status = 'active' DESC, g.status = 'pending' DESC, coalesce(g.finished_at, g.updated_at) DESC
  `)) as ReflexGame[];
}

export async function getReflexGame(id: number): Promise<ReflexGame | null> {
  const [row] = (await sql.query(`SELECT ${COLUMNS} FROM reflex_games g WHERE g.id = $1`, [id])) as ReflexGame[];
  return row ?? null;
}

export function timesOf(game: ReflexGame, userId: number): number[] {
  return userId === game.challenger_id ? game.challenger_times : game.opponent_times;
}

export type ExpiredReflex = { id: number; challenger_id: number; stake: number };
export type TimedOutReflex = { id: number; winner_id: number; loser_id: number; prize: number };

export async function settleReflexGames(): Promise<{ expired: ExpiredReflex[]; timedOut: TimedOutReflex[] }> {
  const R = await getRules();
  const [expired, timedOut] = await Promise.all([
    sql`
      WITH g AS (
        UPDATE reflex_games SET status = 'expired', updated_at = now(), finished_at = now()
        WHERE status = 'pending' AND created_at < now() - make_interval(hours => ${R.reflexAcceptHours})
        RETURNING id, challenger_id, stake
      ),
      r AS (
        INSERT INTO ledger (user_id, amount, reason)
        SELECT challenger_id, stake, 'Gatilho n.º ' || id || ': desafio expirou, devolução' FROM g WHERE stake > 0
      )
      SELECT id, challenger_id, stake FROM g
    `,
    sql`
      WITH g AS (
        UPDATE reflex_games
        SET status = 'finished', finish_reason = 'tempo', finished_at = now(), updated_at = now(), deadline_at = NULL,
          attempt_issued_at = NULL, attempt_delay_ms = NULL,
          winner_id = CASE WHEN turn_id = challenger_id THEN opponent_id ELSE challenger_id END
        WHERE status = 'active' AND deadline_at < now()
        RETURNING id, winner_id, turn_id AS loser_id, stake
      ),
      p AS (
        INSERT INTO ledger (user_id, amount, reason)
        SELECT winner_id, (stake * 2 - ceil(stake * 2 * ${R.reflexHouseCutPct}::numeric / 100))::int,
          'Gatilho n.º ' || id || ': vitória por falta de comparência'
        FROM g WHERE stake > 0
      )
      SELECT id, winner_id, loser_id, (stake * 2 - ceil(stake * 2 * ${R.reflexHouseCutPct}::numeric / 100))::int AS prize FROM g
    `,
  ]);
  return { expired: expired as ExpiredReflex[], timedOut: timedOut as TimedOutReflex[] };
}
