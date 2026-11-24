import "server-only";
import { sql } from "./db";
import { getRules } from "./rules";

export type BetStatus = "open" | "closed" | "resolved" | "void";

export const STATUS_LABEL: Record<BetStatus, string> = {
  open: "Aberta",
  closed: "À espera do resultado",
  resolved: "Resolvida",
  void: "Anulada",
};

export type BetSummary = {
  id: number;
  title: string;
  closes_at: Date;
  status: BetStatus;
  pot: number;
  bettors: number;
  winner: string | null;
};

export type BetOption = { id: number; label: string; total: number; bettors: number; payout: number | null };

export type Wager = { name: string; user_id: number; option_id: number; amount: number; created_at: Date };

export type BetDetail = BetSummary & {
  description: string;
  author: string | null;
  created_by: number | null;
  winning_option: number | null;
  options: BetOption[];
  wagers: Wager[];
  mine: Wager[];
};

export function netPot(pot: number, cutPct: number): number {
  return pot - Math.ceil((pot * cutPct) / 100);
}

export function payoutPerGrain(pot: number, optionTotal: number, cutPct: number): number | null {
  return optionTotal > 0 ? netPot(pot, cutPct) / optionTotal : null;
}

const STATUS_SQL = `CASE WHEN b.status = 'open' AND b.closes_at <= now() THEN 'closed' ELSE b.status END`;

export async function listBets(): Promise<BetSummary[]> {
  return (await sql.query(`
    SELECT b.id, b.title, b.closes_at, ${STATUS_SQL} AS status,
      coalesce((SELECT sum(w.amount) FROM bet_wagers w WHERE w.bet_id = b.id), 0)::int AS pot,
      (SELECT count(DISTINCT w.user_id) FROM bet_wagers w WHERE w.bet_id = b.id)::int AS bettors,
      (SELECT o.label FROM bet_options o WHERE o.id = b.winning_option) AS winner
    FROM bets b
    ORDER BY (${STATUS_SQL}) = 'open' DESC, (${STATUS_SQL}) = 'closed' DESC,
      CASE WHEN b.status = 'open' THEN b.closes_at END ASC, b.id DESC
  `)) as BetSummary[];
}

export async function featuredBet(): Promise<BetSummary | null> {
  const open = (await listBets()).filter((b) => b.status === "open");
  return open[0] ?? null;
}

export async function getBet(id: number, viewerId: number): Promise<BetDetail | null> {
  const [bet] = (await sql.query(
    `
    SELECT b.id, b.title, b.description, b.closes_at, ${STATUS_SQL} AS status, b.winning_option, b.created_by,
      CASE WHEN b.created_by IS NULL THEN NULL ELSE member_label(b.created_by) END AS author,
      coalesce((SELECT sum(w.amount) FROM bet_wagers w WHERE w.bet_id = b.id), 0)::int AS pot,
      (SELECT count(DISTINCT w.user_id) FROM bet_wagers w WHERE w.bet_id = b.id)::int AS bettors,
      (SELECT o.label FROM bet_options o WHERE o.id = b.winning_option) AS winner
    FROM bets b WHERE b.id = $1
  `,
    [id],
  )) as Omit<BetDetail, "options" | "wagers" | "mine">[];
  if (!bet) return null;
  const [optionRows, wagerRows] = await Promise.all([
    sql`
      SELECT o.id, o.label,
        coalesce(sum(w.amount), 0)::int AS total,
        count(DISTINCT w.user_id)::int AS bettors
      FROM bet_options o LEFT JOIN bet_wagers w ON w.option_id = o.id
      WHERE o.bet_id = ${id}
      GROUP BY o.id, o.label, o.position ORDER BY o.position
    `,
    sql`
      SELECT member_label(w.user_id) AS name, w.user_id, w.option_id, w.amount::int AS amount, w.created_at
      FROM bet_wagers w WHERE w.bet_id = ${id} ORDER BY w.created_at
    `,
  ]);
  const options = optionRows as Omit<BetOption, "payout">[];
  const { betHouseCutPct } = await getRules();
  const wagers = wagerRows as Wager[];
  return {
    ...bet,
    options: options.map((o) => ({ ...o, payout: payoutPerGrain(bet.pot, o.total, betHouseCutPct) })),
    wagers: bet.status === "open" ? [] : wagers,
    mine: wagers.filter((w) => w.user_id === viewerId),
  };
}

export type BetResult = { user_id: number; staked: number; returned: number };

export async function betResults(betId: number): Promise<BetResult[]> {
  return (await sql`
    SELECT u.user_id,
      coalesce((SELECT sum(w.amount) FROM bet_wagers w WHERE w.bet_id = ${betId} AND w.user_id = u.user_id), 0)::int AS staked,
      coalesce((SELECT sum(l.amount) FROM ledger l WHERE l.bet_id = ${betId} AND l.user_id = u.user_id AND l.amount > 0), 0)::int AS returned
    FROM (SELECT DISTINCT user_id FROM bet_wagers WHERE bet_id = ${betId}) u
  `) as BetResult[];
}
