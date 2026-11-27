import "server-only";
import { randomBytes, randomInt } from "node:crypto";
import { sql } from "./db";
import { DUCKS, duckName } from "./ducks-table";
import { getRules } from "./rules";
import { onDay } from "./comedy";

export type Race = { id: number; race_at: Date; status: "open" | "finished"; winner: number | null; seed: string | null };

export type RaceResult = { id: number; winner: number; payouts: { user_id: number; staked: number; prize: number }[] };

export type RaceSchedule = { day: number; hour: number };

export const DEFAULT_RACE_SCHEDULE: RaceSchedule = { day: 7, hour: 21 };

export function raceScheduleProblem(s: RaceSchedule): string | null {
  if (!Number.isInteger(s.day) || s.day < 1 || s.day > 7) return "Escolhe um dia da semana.";
  if (!Number.isInteger(s.hour) || s.hour < 0 || s.hour > 23) return "A hora vai das 0h às 23h.";
  return null;
}

export function describeRace(s: RaceSchedule): string {
  return `${onDay(s.day)} às ${s.hour}h`;
}

export async function getRaceSchedule(): Promise<RaceSchedule> {
  const rows = (await sql`SELECT key, value FROM settings WHERE key IN ('patos_dia', 'patos_hora')`) as { key: string; value: string }[];
  const get = (key: string) => rows.find((r) => r.key === key)?.value;
  const schedule = { day: Number(get("patos_dia") ?? DEFAULT_RACE_SCHEDULE.day), hour: Number(get("patos_hora") ?? DEFAULT_RACE_SCHEDULE.hour) };
  return raceScheduleProblem(schedule) ? DEFAULT_RACE_SCHEDULE : schedule;
}

export async function ensureOpenRace(): Promise<Race> {
  const { day, hour } = await getRaceSchedule();
  await sql`
    WITH s AS (
      SELECT ((date_trunc('week', now() AT TIME ZONE 'Europe/Lisbon') + make_interval(days => ${day - 1}, hours => ${hour})) AT TIME ZONE 'Europe/Lisbon') AS slot
    ),
    t AS (SELECT CASE WHEN slot > now() THEN slot ELSE slot + interval '7 days' END AS race_at FROM s)
    INSERT INTO duck_races (race_at, simulated)
    SELECT t.race_at, false FROM t
    WHERE NOT EXISTS (SELECT 1 FROM duck_races r WHERE r.race_at = t.race_at)
    ON CONFLICT (race_at) DO NOTHING
  `;
  const [race] = (await sql`
    SELECT id, race_at, status, winner, seed FROM duck_races
    WHERE status = 'open' AND race_at > now() ORDER BY race_at LIMIT 1
  `) as Race[];
  return race;
}

export async function resolveDueRaces(): Promise<RaceResult[]> {
  const { raceHouseCutPct } = await getRules();
  const due = (await sql`SELECT id FROM duck_races WHERE status = 'open' AND race_at <= now() ORDER BY race_at`) as {
    id: number;
  }[];
  const results: RaceResult[] = [];
  for (const { id } of due) {
    const winner = DUCKS[randomInt(DUCKS.length)].n;
    const seed = randomBytes(8).toString("hex");
    const [row] = (await sql`
      WITH r AS (
        UPDATE duck_races SET status = 'finished', winner = ${winner}, seed = ${seed}, finished_at = now()
        WHERE id = ${id} AND status = 'open'
        RETURNING id
      ),
      b AS (SELECT user_id, duck, amount FROM duck_bets WHERE race_id IN (SELECT id FROM r)),
      tot AS (
        SELECT coalesce(sum(amount), 0)::numeric AS pot,
          coalesce(sum(amount) FILTER (WHERE duck = ${winner}), 0)::numeric AS win
        FROM b
      ),
      pay AS (
        SELECT b.user_id,
          floor(sum(b.amount) * (tot.pot - ceil(tot.pot * ${raceHouseCutPct}::numeric / 100)) / tot.win)::int AS prize
        FROM b, tot WHERE b.duck = ${winner}
        GROUP BY b.user_id, tot.pot, tot.win
      ),
      paid AS (
        INSERT INTO ledger (user_id, amount, reason)
        SELECT user_id, prize, ${`Corrida de Patos n.º ${id}: prémio (${duckName(winner)})`} FROM pay WHERE prize > 0
      )
      SELECT (SELECT count(*) FROM r)::int AS done,
        coalesce((
          SELECT json_agg(json_build_object(
            'user_id', s.user_id, 'staked', s.staked, 'prize', coalesce(p.prize, 0)))
          FROM (SELECT user_id, sum(amount)::int AS staked FROM b GROUP BY user_id) s
          LEFT JOIN pay p ON p.user_id = s.user_id
        ), '[]'::json) AS payouts
    `) as { done: number; payouts: RaceResult["payouts"] }[];
    if (row?.done) results.push({ id, winner, payouts: row.payouts });
  }
  return results;
}

export type RaceOption = { duck: number; total: number; bettors: number };

export async function raceBoard(raceId: number): Promise<RaceOption[]> {
  const rows = (await sql`
    SELECT duck, sum(amount)::int AS total, count(DISTINCT user_id)::int AS bettors
    FROM duck_bets WHERE race_id = ${raceId} GROUP BY duck
  `) as RaceOption[];
  return DUCKS.map((d) => rows.find((r) => r.duck === d.n) ?? { duck: d.n, total: 0, bettors: 0 });
}

export type RaceWager = { name: string; user_id: number; duck: number; amount: number };

export async function raceWagers(raceId: number): Promise<RaceWager[]> {
  return (await sql`
    SELECT u.name, b.user_id, b.duck, sum(b.amount)::int AS amount
    FROM duck_bets b JOIN users u ON u.id = b.user_id
    WHERE b.race_id = ${raceId}
    GROUP BY u.name, b.user_id, b.duck ORDER BY amount DESC
  `) as RaceWager[];
}

export async function finishedRaces(limit: number): Promise<Race[]> {
  return (await sql`
    SELECT id, race_at, status, winner, seed FROM duck_races
    WHERE status = 'finished' ORDER BY race_at DESC LIMIT ${limit}
  `) as Race[];
}
