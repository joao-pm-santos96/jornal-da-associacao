import "server-only";
import { sql } from "./db";
import { getRules } from "./rules";
import { ATTEMPTS, PENALTY_MS } from "./reflex";

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

export type ReflexRecord = { user_id: number; name: string; ms: number; game_id: number; at: Date };

export async function reflexRecords(limit = 10): Promise<{ since: Date; shots: ReflexRecord[]; averages: ReflexRecord[] }> {
  const [row] = (await sql`
    SELECT coalesce((SELECT value::timestamptz FROM settings WHERE key = 'gatilho_recordes_desde'), now()) AS since
  `) as { since: Date }[];
  const since = new Date(row.since);
  const [shots, averages] = await Promise.all([
    sql`
      WITH t AS (
        SELECT challenger_id AS user_id, unnest(challenger_times) AS ms, id AS game_id, finished_at AS at FROM reflex_games WHERE status = 'finished' AND finished_at >= ${since}
        UNION ALL
        SELECT opponent_id, unnest(opponent_times), id, finished_at FROM reflex_games WHERE status = 'finished' AND finished_at >= ${since}
      ),
      best AS (
        SELECT DISTINCT ON (user_id) user_id, ms, game_id, at FROM t WHERE ms < ${PENALTY_MS} ORDER BY user_id, ms, at
      )
      SELECT user_id, member_label(user_id) AS name, ms, game_id, at FROM best ORDER BY ms, at LIMIT ${limit}
    `,
    sql`
      WITH t AS (
        SELECT challenger_id AS user_id, challenger_times AS times, id AS game_id, finished_at AS at FROM reflex_games WHERE status = 'finished' AND finished_at >= ${since}
        UNION ALL
        SELECT opponent_id, opponent_times, id, finished_at FROM reflex_games WHERE status = 'finished' AND finished_at >= ${since}
      ),
      avgs AS (
        SELECT user_id, (SELECT round(avg(x), 1)::float8 FROM unnest(times) x) AS ms, game_id, at FROM t WHERE cardinality(times) = ${ATTEMPTS}
      ),
      best AS (
        SELECT DISTINCT ON (user_id) user_id, ms, game_id, at FROM avgs ORDER BY user_id, ms, at
      )
      SELECT user_id, member_label(user_id) AS name, ms, game_id, at FROM best ORDER BY ms, at LIMIT ${limit}
    `,
  ]);
  return { since, shots: shots as ReflexRecord[], averages: averages as ReflexRecord[] };
}
