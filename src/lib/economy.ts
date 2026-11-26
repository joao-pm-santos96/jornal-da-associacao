import "server-only";
import { cache } from "react";
import { sql } from "./db";
import { lisbon } from "./seasons";
import { getRules, loadRules } from "./rules";

export { GRAOS } from "./graos";

export const TIP_OPTIONS = [1, 2, 5, 10] as const;
export const GIFT_REASON_MAX = 140;

export type Balance = {
  user_id: number;
  name: string;
  created_at: Date;
  balance: number;
  frozen: boolean;
};

export type Economy = {
  open: boolean;
  start: Date | null;
  supply: number;
  balances: Balance[];
  cofre: number;
  escrow: number;
  available: number;
  debts: number;
  slush: number;
};

type EconomyRow = { start: string | null; supply: string | null; escrow: number; slush: number };

export async function loadEconomy(): Promise<Economy> {
  const [stateRows, balanceRows, rules] = await Promise.all([
    sql`
      SELECT
        (SELECT value FROM settings WHERE key = 'economia_inicio') AS start,
        (SELECT value FROM settings WHERE key = 'economia_massa') AS supply,
        (
          coalesce((SELECT sum(w.amount) FROM bet_wagers w JOIN bets b ON b.id = w.bet_id WHERE b.status = 'open'), 0)
          + coalesce((SELECT sum(d.amount) FROM duck_bets d JOIN duck_races r ON r.id = d.race_id WHERE r.status = 'open'), 0)
          + coalesce((SELECT sum(stake) FROM duels WHERE status = 'pending'), 0)
          + coalesce((SELECT sum(CASE WHEN status = 'active' THEN stake * 2 ELSE stake END) FROM pool_games WHERE status IN ('pending', 'active')), 0)
          + coalesce((SELECT sum(reward) FROM commissions WHERE status IN ('open', 'claimed')), 0)
        )::int AS escrow,
        (SELECT coalesce(sum(amount), 0) FROM slush_moves)::int AS slush
    `,
    sql`
      SELECT u.id AS user_id, member_label(u.id) AS name, u.created_at,
        CASE WHEN EXISTS (SELECT 1 FROM settings WHERE key = 'economia_inicio')
          THEN coalesce((SELECT sum(l.amount) FROM ledger l WHERE l.user_id = u.id AND NOT l.archived), 0)
          ELSE 0
        END::int AS balance
      FROM users u
    `,
    loadRules(),
  ]);
  const [state] = stateRows as EconomyRow[];
  const rows = balanceRows as Omit<Balance, "frozen">[];
  const open = state.start !== null;
  const balances = rows
    .map((r) => ({ ...r, frozen: open && r.balance <= rules.debtFloor }))
    .sort((a, b) => b.balance - a.balance);
  const supply = Number(state.supply ?? 0);
  const slush = open ? state.slush : 0;
  const cofre = open ? supply - slush - balances.reduce((sum, b) => sum + Math.max(b.balance, 0), 0) : 0;
  const escrow = open ? state.escrow : 0;
  return {
    open,
    start: state.start ? new Date(state.start) : null,
    supply,
    balances,
    cofre,
    escrow,
    available: cofre - escrow,
    debts: balances.reduce((sum, b) => sum + Math.max(-b.balance, 0), 0),
    slush,
  };
}

export const getEconomy = cache(loadEconomy);

export async function getBalances(): Promise<Balance[]> {
  return (await getEconomy()).balances;
}

export async function balanceOf(userId: number): Promise<number> {
  return (await getBalances()).find((b) => b.user_id === userId)?.balance ?? 0;
}

export function debit(balance: number, amount: number, floor: number): number {
  return Math.max(0, Math.min(amount, balance - floor));
}

export function splitByPoints(budget: number, points: ReadonlyMap<number, number>, random: () => number): Map<number, number> {
  const total = [...points.values()].reduce((a, b) => a + b, 0);
  const shares = new Map<number, number>();
  if (budget <= 0 || total <= 0) return shares;
  const exact = [...points].filter(([, p]) => p > 0).map(([id, p]) => ({ id, p, exact: (budget * p) / total, tie: random() }));
  for (const e of exact) shares.set(e.id, Math.floor(e.exact));
  let left = budget - [...shares.values()].reduce((a, b) => a + b, 0);
  const order = [...exact].sort((a, b) => b.exact % 1 - a.exact % 1 || b.p - a.p || a.tie - b.tie);
  for (const e of order) {
    if (left <= 0) break;
    shares.set(e.id, (shares.get(e.id) ?? 0) + 1);
    left--;
  }
  return shares;
}

export function addDays(date: string, days: number): string {
  return new Date(Date.parse(`${date}T00:00:00Z`) + days * 86_400_000).toISOString().slice(0, 10);
}

export function mondayOf(date: string): string {
  return addDays(date, -((new Date(`${date}T00:00:00Z`).getUTCDay() + 6) % 7));
}

export function weekOf(now: Date): string {
  return mondayOf(lisbon(now).date);
}

export function lisbonMidnight(date: string): Date {
  const utc = Date.parse(`${date}T00:00:00Z`);
  for (const hours of [0, -1, 1]) {
    const t = new Date(utc + hours * 3_600_000);
    const l = lisbon(t);
    if (l.date === date && l.hour === 0 && l.minute === 0) return t;
  }
  return new Date(utc);
}

export function shortDate(date: string): string {
  return `${date.slice(8, 10)}/${date.slice(5, 7)}`;
}

export type WeekPoints = {
  user_id: number;
  name: string;
  posts: number;
  comments: number;
  laughs: number;
  rota: "none" | "done" | "missed" | "pardoned" | "pending";
  rota_points: boolean;
  extra: number;
  points: number;
};

type WeekRow = Omit<WeekPoints, "points" | "rota"> & { rota_status: WeekPoints["rota"] };

export async function weekPoints(weekStart: string, from: Date, to: Date): Promise<WeekPoints[]> {
  const R = await getRules();
  const rows = (await sql`
    WITH bounds AS (
      SELECT ${from.toISOString()}::timestamptz AS lo, ${to.toISOString()}::timestamptz AS hi,
        ${weekStart}::date::timestamp AT TIME ZONE 'Europe/Lisbon' AS week_lo,
        (${weekStart}::date + 7)::timestamp AT TIME ZONE 'Europe/Lisbon' AS week_hi
    ),
    laughs AS (
      SELECT DISTINCT x.receiver, x.giver, (x.created_at AT TIME ZONE 'Europe/Lisbon')::date AS day FROM (
        SELECT p.author_id AS receiver, r.user_id AS giver, r.created_at FROM post_reactions r JOIN visible_posts p ON p.id = r.post_id
          WHERE r.emoji = '😂' AND r.user_id <> p.author_id
        UNION ALL
        SELECT c.author_id, r.user_id, r.created_at FROM comment_reactions r JOIN comments c ON c.id = r.comment_id
          WHERE r.emoji = '😂' AND r.user_id <> c.author_id
      ) x, bounds b WHERE x.created_at >= b.lo AND x.created_at < b.hi
    )
    SELECT u.id AS user_id, member_label(u.id) AS name,
      (SELECT count(*) FROM visible_posts p, bounds b
        WHERE p.author_id = u.id AND p.publish_at >= b.lo AND p.publish_at < b.hi)::int AS posts,
      (SELECT count(*) FROM comments c, bounds b
        WHERE c.author_id = u.id AND c.created_at >= b.lo AND c.created_at < b.hi)::int AS comments,
      (SELECT count(*) FROM laughs l WHERE l.receiver = u.id)::int AS laughs,
      CASE
        WHEN r.user_id IS NULL THEN 'none'
        WHEN EXISTS (SELECT 1 FROM visible_posts p, bounds b
          WHERE p.author_id = u.id AND p.publish_at >= b.week_lo AND p.publish_at < b.week_hi) THEN 'done'
        WHEN r.pardoned THEN 'pardoned'
        WHEN (SELECT hi FROM bounds) >= (SELECT week_hi FROM bounds) THEN 'missed'
        ELSE 'pending'
      END AS rota_status,
      EXISTS (SELECT 1 FROM visible_posts p, bounds b
        WHERE r.user_id IS NOT NULL AND p.author_id = u.id AND p.publish_at >= greatest(b.lo, b.week_lo) AND p.publish_at < b.week_hi
      ) AS rota_points,
      coalesce((SELECT sum(e.points) FROM payroll_extra_points e WHERE e.week_start = ${weekStart}::date AND e.user_id = u.id), 0)::int AS extra
    FROM users u
    LEFT JOIN rota_slots r ON r.week_start = ${weekStart}::date AND r.user_id = u.id
    ORDER BY u.id
  `) as WeekRow[];
  return rows.map(({ rota_status, ...r }) => ({
    ...r,
    rota: rota_status,
    points:
      rota_status === "missed"
        ? 0
        : r.posts * R.post +
          Math.min(r.comments, R.commentCap) * R.comment +
          Math.min(r.laughs, R.laughCap) * R.laugh +
          (rota_status === "done" && r.rota_points ? R.rotaDone : 0) +
          r.extra,
  }));
}

export function payrollBudget(available: number, pct: number): number {
  return Math.floor((Math.max(available, 0) * pct) / 100);
}

export type Movement = { key: string; name: string; amount: number; reason: string; by: string | null; created_at: Date };

export async function listMovements(limit = 30): Promise<Movement[]> {
  return (await sql`
    SELECT * FROM (
      SELECT 'l' || l.id AS key, member_label(l.user_id) AS name, l.amount, l.reason,
        CASE WHEN l.created_by IS NULL THEN NULL ELSE member_label(l.created_by) END AS by, l.created_at, l.id
      FROM ledger l
      WHERE NOT l.archived
      UNION ALL
      SELECT 's' || s.id, CASE WHEN s.kind = 'confisco' THEN member_label(s.owner_id) ELSE 'Cofre' END,
        -s.amount, s.reason,
        CASE WHEN s.kind = 'confisco' THEN NULL ELSE 'ordem superior' END, s.created_at, s.id
      FROM slush_moves s
      WHERE s.kind IN ('desvio', 'recompensa', 'confisco')
    ) m
    ORDER BY created_at DESC, id DESC
    LIMIT ${limit}
  `) as Movement[];
}
