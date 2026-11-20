import "server-only";
import { sql } from "./db";

export const ECONOMY_START = "2026-11-01";

export const TREMOCOS = {
  post: 5,
  comment: 1,
  laugh: 1,
  rotaDone: 10,
  monthlyFee: 10,
  rotaMissedFine: 20,
  manualMax: 100,
  freezeBelow: -50,
} as const;

export type Balance = {
  user_id: number;
  name: string;
  posts: number;
  comments: number;
  laughs: number;
  rota_done: number;
  rota_missed: number;
  months: number;
  manual: number;
  earned: number;
  fees: number;
  fines: number;
  balance: number;
  frozen: boolean;
};

type Counts = Omit<Balance, "earned" | "fees" | "fines" | "balance" | "frozen">;

function settle(c: Counts): Balance {
  const earned =
    c.posts * TREMOCOS.post +
    c.comments * TREMOCOS.comment +
    c.laughs * TREMOCOS.laugh +
    c.rota_done * TREMOCOS.rotaDone;
  const fees = c.months * TREMOCOS.monthlyFee;
  const fines = c.rota_missed * TREMOCOS.rotaMissedFine;
  const balance = earned - fees - fines + c.manual;
  return { ...c, earned, fees, fines, balance, frozen: balance < TREMOCOS.freezeBelow };
}

export async function getBalances(): Promise<Balance[]> {
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
          greatest(${ECONOMY_START}::date, date_trunc('month', u.created_at AT TIME ZONE 'Europe/Lisbon')::date),
          (now() AT TIME ZONE 'Europe/Lisbon')::date,
          interval '1 month'))::int AS months,
      coalesce((SELECT sum(l.amount) FROM ledger l WHERE l.user_id = u.id), 0)::int AS manual
    FROM users u
    ORDER BY u.id
  `) as Counts[];
  return rows.map(settle).sort((a, b) => b.balance - a.balance);
}

export function treasury(balances: Balance[]): number {
  return balances.reduce((total, b) => total + b.fees + b.fines - b.manual, 0);
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
