import "server-only";
import { sql } from "./db";
import { addDays, lisbonMidnight, loadEconomy, weekOf } from "./economy";
import type { Rules } from "./rules";

export const JOKE_MAX = 1000;

export type ComedyPhase = "submit" | "voting";
export type ComedyClock = { week: string; phase: ComedyPhase; opensAt: Date; closesAt: Date };

export type ComedySchedule = { day: number; opens: number; closes: number };

export const DEFAULT_SCHEDULE: ComedySchedule = { day: 5, opens: 12, closes: 16 };

export const DAY_NAMES = ["segunda-feira", "terça-feira", "quarta-feira", "quinta-feira", "sexta-feira", "sábado", "domingo"] as const;

export function onDay(day: number): string {
  return `${day >= 6 ? "ao" : "à"} ${DAY_NAMES[day - 1]}`;
}

export function scheduleProblem(s: ComedySchedule): string | null {
  if (!Number.isInteger(s.day) || s.day < 1 || s.day > 7) return "Escolhe um dia da semana.";
  if (!Number.isInteger(s.opens) || s.opens < 0 || s.opens > 23) return "A hora de abertura vai das 0h às 23h.";
  if (!Number.isInteger(s.closes) || s.closes < 1 || s.closes > 24) return "A hora de fecho vai da 1h às 24h.";
  if (s.closes <= s.opens) return "A votação tem de fechar depois de abrir.";
  return null;
}

export async function getComedySchedule(): Promise<ComedySchedule> {
  const rows = (await sql`SELECT key, value FROM settings WHERE key IN ('comedy_dia', 'comedy_abre', 'comedy_fecha')`) as { key: string; value: string }[];
  const get = (key: string) => rows.find((r) => r.key === key)?.value;
  const schedule = {
    day: Number(get("comedy_dia") ?? DEFAULT_SCHEDULE.day),
    opens: Number(get("comedy_abre") ?? DEFAULT_SCHEDULE.opens),
    closes: Number(get("comedy_fecha") ?? DEFAULT_SCHEDULE.closes),
  };
  return scheduleProblem(schedule) ? DEFAULT_SCHEDULE : schedule;
}

function votingWindow(week: string, schedule: ComedySchedule): { opensAt: Date; closesAt: Date } {
  const day = lisbonMidnight(addDays(week, schedule.day - 1)).getTime();
  return { opensAt: new Date(day + schedule.opens * 3_600_000), closesAt: new Date(day + schedule.closes * 3_600_000) };
}

export function comedyClock(now: Date, schedule: ComedySchedule): ComedyClock {
  let week = weekOf(now);
  let window = votingWindow(week, schedule);
  if (now >= window.closesAt) {
    week = addDays(week, 7);
    window = votingWindow(week, schedule);
  }
  return { week, phase: now >= window.opensAt ? "voting" : "submit", ...window };
}

export type Joke = { id: number; author_id: number; author: string; body: string; created_at: Date; votes: number };

export async function jokesFor(week: string): Promise<Joke[]> {
  return (await sql`
    SELECT j.id, j.author_id, member_label(j.author_id) AS author, j.body, j.created_at,
      (SELECT count(*) FROM comedy_votes v WHERE v.joke_id = j.id)::int AS votes
    FROM comedy_jokes j WHERE j.week_start = ${week}::date
    ORDER BY j.created_at, j.id
  `) as Joke[];
}

export async function myVote(week: string, userId: number): Promise<number | null> {
  const [row] = (await sql`SELECT joke_id FROM comedy_votes WHERE week_start = ${week}::date AND voter_id = ${userId}`) as { joke_id: number }[];
  return row?.joke_id ?? null;
}

export type ComedyResult = {
  week_start: string;
  closed_at: Date;
  winner_id: number | null;
  winner: string | null;
  prize: number;
  body: string | null;
  votes: number;
  entries: number;
};

export async function pastResults(limit = 8): Promise<ComedyResult[]> {
  return (await sql`
    SELECT w.week_start::text, w.closed_at, w.winner_id,
      CASE WHEN w.winner_id IS NULL THEN NULL ELSE member_label(w.winner_id) END AS winner, w.prize,
      j.body, (SELECT count(*) FROM comedy_votes v WHERE v.joke_id = w.winner_joke_id)::int AS votes,
      (SELECT count(*) FROM comedy_jokes x WHERE x.week_start = w.week_start)::int AS entries
    FROM comedy_weeks w LEFT JOIN comedy_jokes j ON j.id = w.winner_joke_id
    WHERE w.closed_at IS NOT NULL
    ORDER BY w.week_start DESC LIMIT ${limit}
  `) as ComedyResult[];
}

export async function openVoting(now: Date, schedule: ComedySchedule): Promise<{ week: string; jokes: number } | null> {
  const clock = comedyClock(now, schedule);
  if (clock.phase !== "voting") return null;
  const [row] = (await sql`
    INSERT INTO comedy_weeks (week_start, voting_notified_at) VALUES (${clock.week}::date, ${now.toISOString()}::timestamptz)
    ON CONFLICT (week_start) DO UPDATE SET voting_notified_at = EXCLUDED.voting_notified_at
    WHERE comedy_weeks.voting_notified_at IS NULL
    RETURNING (SELECT count(*) FROM comedy_jokes WHERE week_start = ${clock.week}::date)::int AS jokes
  `) as { jokes: number }[];
  return row && row.jokes > 0 ? { week: clock.week, jokes: row.jokes } : null;
}

export type ClosedComedy = { week: string; winner_id: number | null; winner: string | null; prize: number; body: string | null; votes: number };

export async function closeDueWeeks(now: Date, R: Rules, schedule: ComedySchedule): Promise<ClosedComedy[]> {
  const weeks = (await sql`
    SELECT DISTINCT j.week_start::text AS week FROM comedy_jokes j
    LEFT JOIN comedy_weeks w ON w.week_start = j.week_start
    WHERE w.closed_at IS NULL
  `) as { week: string }[];
  const due = weeks.map((w) => w.week).filter((week) => votingWindow(week, schedule).closesAt <= now);
  const closed: ClosedComedy[] = [];
  for (const week of due) {
    const [top] = (await sql`
      SELECT j.id, j.author_id, j.body, count(v.voter_id)::int AS votes
      FROM comedy_jokes j LEFT JOIN comedy_votes v ON v.joke_id = j.id
      WHERE j.week_start = ${week}::date
      GROUP BY j.id ORDER BY votes DESC, j.created_at, j.id LIMIT 1
    `) as { id: number; author_id: number; body: string; votes: number }[];
    const winner = top && top.votes > 0 ? top : null;
    const available = winner ? (await loadEconomy()).available : 0;
    const prize = winner ? Math.max(0, Math.min(R.comedyPrize, available)) : 0;
    const [row] = (await sql`
      WITH w AS (
        INSERT INTO comedy_weeks (week_start, closed_at, winner_joke_id, winner_id, prize)
        VALUES (${week}::date, ${now.toISOString()}::timestamptz, ${winner?.id ?? null}::int, ${winner?.author_id ?? null}::int, ${prize})
        ON CONFLICT (week_start) DO UPDATE SET closed_at = EXCLUDED.closed_at, winner_joke_id = EXCLUDED.winner_joke_id,
          winner_id = EXCLUDED.winner_id, prize = EXCLUDED.prize
        WHERE comedy_weeks.closed_at IS NULL
        RETURNING week_start, winner_id, prize
      ),
      l AS (
        INSERT INTO ledger (user_id, amount, reason, kind)
        SELECT winner_id, prize, 'Comedy Club: palhaço da semana 🤡', 'comedy' FROM w WHERE winner_id IS NOT NULL AND prize > 0
      )
      SELECT winner_id, CASE WHEN winner_id IS NULL THEN NULL ELSE member_label(winner_id) END AS winner, prize FROM w
    `) as { winner_id: number | null; winner: string | null; prize: number }[];
    if (row) closed.push({ week, ...row, body: winner?.body ?? null, votes: winner?.votes ?? 0 });
  }
  return closed;
}

export async function pendingComedyVote(now: Date, schedule: ComedySchedule, userId: number): Promise<Date | null> {
  const clock = comedyClock(now, schedule);
  if (clock.phase !== "voting") return null;
  const [row] = (await sql`
    SELECT EXISTS (SELECT 1 FROM comedy_jokes WHERE week_start = ${clock.week}::date AND author_id <> ${userId})
      AND NOT EXISTS (SELECT 1 FROM comedy_votes WHERE week_start = ${clock.week}::date AND voter_id = ${userId}) AS pending
  `) as { pending: boolean }[];
  return row.pending ? clock.closesAt : null;
}
