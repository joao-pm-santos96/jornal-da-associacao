import "server-only";
import { sql } from "./db";

export const LOAN_OFFER_HOURS = 48;
export const LOAN_MAX_DAYS = 30;
export const LOAN_MAX_RATE = 100;

export type LoanStatus = "offered" | "active" | "defaulted" | "repaid" | "declined" | "cancelled" | "expired";

export type Loan = {
  id: number;
  lender_id: number;
  lender: string;
  borrower_id: number;
  borrower: string;
  principal: number;
  rate_pct: number;
  term_days: number;
  total: number;
  repaid: number;
  status: LoanStatus;
  due_at: Date | null;
  created_at: Date;
  settled_at: Date | null;
};

export function loanTotal(principal: number, ratePct: number): number {
  return principal + Math.ceil((principal * ratePct) / 100);
}

const COLUMNS = `
  l.id, l.lender_id, member_label(l.lender_id) AS lender, l.borrower_id, member_label(l.borrower_id) AS borrower,
  l.principal, l.rate_pct, l.term_days, l.total, l.repaid, l.status, l.due_at, l.created_at, l.settled_at
`;

export async function listLoans(): Promise<Loan[]> {
  return (await sql.query(`
    SELECT ${COLUMNS} FROM loans l
    WHERE l.status IN ('offered', 'active', 'defaulted')
       OR l.id IN (SELECT id FROM loans WHERE status = 'repaid' ORDER BY settled_at DESC LIMIT 15)
    ORDER BY l.status = 'defaulted' DESC, l.status = 'active' DESC, l.status = 'offered' DESC, coalesce(l.settled_at, l.created_at) DESC
  `)) as Loan[];
}

export async function getLoan(id: number): Promise<Loan | null> {
  const [row] = (await sql.query(`SELECT ${COLUMNS} FROM loans l WHERE l.id = $1`, [id])) as Loan[];
  return row ?? null;
}

export async function balanceOf(userId: number): Promise<number> {
  const [row] = (await sql`SELECT coalesce(sum(amount), 0)::int AS balance FROM ledger WHERE user_id = ${userId} AND NOT archived`) as { balance: number }[];
  return row.balance;
}

export async function collect(loan: Loan, amount: number, reason: "devolução" | "cobrança"): Promise<Loan | null> {
  const pay = Math.min(amount, loan.total - loan.repaid);
  if (pay <= 0) return null;
  const [row] = (await sql`
    WITH u AS (
      UPDATE loans
      SET repaid = repaid + ${pay},
        status = CASE WHEN repaid + ${pay} >= total THEN 'repaid' WHEN due_at <= now() THEN 'defaulted' ELSE status END,
        settled_at = CASE WHEN repaid + ${pay} >= total THEN now() ELSE settled_at END
      WHERE id = ${loan.id} AND repaid = ${loan.repaid} AND status IN ('active', 'defaulted')
      RETURNING id
    ),
    g AS (
      INSERT INTO ledger (user_id, amount, reason, kind)
      SELECT ${loan.borrower_id}::int, ${-pay}::int, 'Empréstimo n.º ' || ${loan.id} || ': ' || ${reason} || ' a ' || member_label(${loan.lender_id}), 'emprestimo' FROM u
      UNION ALL
      SELECT ${loan.lender_id}::int, ${pay}::int, 'Empréstimo n.º ' || ${loan.id} || ': ' || ${reason} || ' de ' || member_label(${loan.borrower_id}), 'emprestimo' FROM u
    )
    SELECT id FROM u
  `) as { id: number }[];
  return row ? await getLoan(loan.id) : null;
}

export type LoanEvent =
  | { kind: "expired"; loan: Loan }
  | { kind: "reminder"; loan: Loan }
  | { kind: "collected"; loan: Loan; paid: number; due: boolean };

export async function settleLoans(): Promise<LoanEvent[]> {
  const events: LoanEvent[] = [];
  const expired = (await sql.query(`
    WITH e AS (
      UPDATE loans SET status = 'expired', settled_at = now()
      WHERE status = 'offered' AND created_at < now() - make_interval(hours => ${LOAN_OFFER_HOURS})
      RETURNING id
    )
    SELECT ${COLUMNS} FROM loans l WHERE l.id IN (SELECT id FROM e)
  `)) as Loan[];
  for (const loan of expired) events.push({ kind: "expired", loan });

  const reminders = (await sql.query(`
    WITH r AS (
      UPDATE loans SET reminded = true
      WHERE status = 'active' AND NOT reminded AND due_at > now() AND due_at <= now() + interval '1 day'
      RETURNING id
    )
    SELECT ${COLUMNS} FROM loans l WHERE l.id IN (SELECT id FROM r)
  `)) as Loan[];
  for (const loan of reminders) events.push({ kind: "reminder", loan });

  const owed = (await sql.query(`
    SELECT ${COLUMNS} FROM loans l WHERE (l.status = 'active' AND l.due_at <= now()) OR l.status = 'defaulted'
  `)) as Loan[];
  for (const loan of owed) {
    const due = loan.status === "active";
    const balance = await balanceOf(loan.borrower_id);
    const after = balance > 0 ? await collect(loan, balance, "cobrança") : null;
    if (after) events.push({ kind: "collected", loan: after, paid: after.repaid - loan.repaid, due });
    else if (due) {
      await sql`UPDATE loans SET status = 'defaulted' WHERE id = ${loan.id} AND status = 'active'`;
      events.push({ kind: "collected", loan: { ...loan, status: "defaulted" }, paid: 0, due });
    }
  }
  return events;
}
