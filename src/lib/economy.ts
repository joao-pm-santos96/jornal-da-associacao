import "server-only";
import { sql } from "./db";
import { easterSunday, getNow, lisbon } from "./seasons";

export const ECONOMY_START = "2026-11-01";

export const GRAOS = {
  post: 5,
  comment: 1,
  laugh: 1,
  rotaDone: 10,
  weeklyFee: 2,
  rotaMissedFine: 20,
  xmasBonus: 10,
  folar: 5,
  adventPrize: 2,
  egg: 1,
  freezeBelow: -50,
  betHouseCutPct: 10,
  betManagerFee: 2,
  betManagerMinBettors: 3,
  betClosingWarningHours: 2,
} as const;

export type Balance = {
  user_id: number;
  name: string;
  posts: number;
  comments: number;
  laughs: number;
  rota_done: number;
  rota_missed: number;
  weeks: number;
  manual: number;
  created_at: Date;
  bonuses: number;
  earned: number;
  fees: number;
  fines: number;
  balance: number;
  frozen: boolean;
};

type Counts = Omit<Balance, "bonuses" | "earned" | "fees" | "fines" | "balance" | "frozen">;

function festiveDates(now: Date): string[] {
  const start = Number(ECONOMY_START.slice(0, 4));
  const today = lisbon(now).date;
  const dates: string[] = [];
  for (let y = start; y <= lisbon(now).year; y++) {
    dates.push(`${y}-12-15`, easterSunday(y));
  }
  return dates.filter((d) => d >= ECONOMY_START && d <= today);
}

function bonusFor(createdAt: Date, now: Date): number {
  const joined = lisbon(createdAt).date;
  return festiveDates(now)
    .filter((d) => d >= joined)
    .reduce((sum, d) => sum + (d.endsWith("-12-15") ? GRAOS.xmasBonus : GRAOS.folar), 0);
}

function settle(c: Counts, now: Date): Balance {
  const earned =
    c.posts * GRAOS.post +
    c.comments * GRAOS.comment +
    c.laughs * GRAOS.laugh +
    c.rota_done * GRAOS.rotaDone;
  const fees = c.weeks * GRAOS.weeklyFee;
  const fines = c.rota_missed * GRAOS.rotaMissedFine;
  const bonuses = bonusFor(c.created_at, now);
  const balance = earned - fees - fines + bonuses + c.manual;
  return { ...c, bonuses, earned, fees, fines, balance, frozen: balance < GRAOS.freezeBelow };
}

export async function getBalances(): Promise<Balance[]> {
  const now = await getNow();
  const rows = (await sql`
    WITH slots AS (
      SELECT r.user_id, r.pardoned,
        EXISTS (
          SELECT 1 FROM visible_posts p WHERE p.author_id = r.user_id
            AND p.publish_at >= r.week_start::timestamp AT TIME ZONE 'Europe/Lisbon'
            AND p.publish_at < (r.week_start + 7)::timestamp AT TIME ZONE 'Europe/Lisbon'
        ) AS done,
        now() >= (r.week_start + 7)::timestamp AT TIME ZONE 'Europe/Lisbon' AS ended
      FROM rota_slots r
    )
    SELECT u.id AS user_id, member_label(u.id) AS name,
      (SELECT count(*) FROM visible_posts p WHERE p.author_id = u.id)::int AS posts,
      (SELECT count(*) FROM comments c WHERE c.author_id = u.id)::int AS comments,
      ((SELECT count(*) FROM post_reactions r JOIN posts p ON p.id = r.post_id
          WHERE p.author_id = u.id AND r.user_id <> u.id AND r.emoji = '😂')
        + (SELECT count(*) FROM comment_reactions r JOIN comments c ON c.id = r.comment_id
          WHERE c.author_id = u.id AND r.user_id <> u.id AND r.emoji = '😂'))::int AS laughs,
      (SELECT count(*) FROM slots s WHERE s.user_id = u.id AND s.done)::int AS rota_done,
      (SELECT count(*) FROM slots s WHERE s.user_id = u.id AND s.ended AND NOT s.done AND NOT s.pardoned)::int
        AS rota_missed,
      (SELECT count(*) FROM generate_series(
          greatest(${ECONOMY_START}::date, (u.created_at AT TIME ZONE 'Europe/Lisbon')::date),
          (jornal_now() AT TIME ZONE 'Europe/Lisbon')::date,
          interval '1 day') d
        WHERE extract(isodow FROM d) = 1)::int AS weeks,
      coalesce((SELECT sum(l.amount) FROM ledger l WHERE l.user_id = u.id), 0)::float8 AS manual,
      u.created_at
    FROM users u
    ORDER BY u.id
  `) as Counts[];
  return rows.map((r) => settle(r, now)).sort((a, b) => b.balance - a.balance);
}

export function treasury(balances: Balance[]): number {
  return balances.reduce((total, b) => total + b.fees + b.fines - b.bonuses - b.manual, 0);
}

export type Movement = { id: number; name: string; amount: number; reason: string; by: string | null; created_at: Date };

export async function listMovements(limit = 30): Promise<Movement[]> {
  return (await sql`
    SELECT l.id, member_label(l.user_id) AS name, l.amount, l.reason,
      CASE WHEN l.created_by IS NULL THEN NULL ELSE member_label(l.created_by) END AS by, l.created_at
    FROM ledger l
    ORDER BY l.created_at DESC
    LIMIT ${limit}
  `) as Movement[];
}
