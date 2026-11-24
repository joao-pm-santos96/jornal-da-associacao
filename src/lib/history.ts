import "server-only";
import { sql } from "./db";
import { loadEconomy } from "./economy";

export type HistoryEntry = {
  user_id: number;
  name: string;
  at: Date;
  kind: string | null;
  amount: number;
  label: string;
  href: string | null;
};

export type StatementLine = HistoryEntry & { balance: number };

type LedgerLine = HistoryEntry & { id: number };

async function ledgerLines(userId: number | null): Promise<LedgerLine[]> {
  const rows = (await sql`
    SELECT l.id, l.user_id, member_label(l.user_id) AS name, l.created_at AS at, l.kind, l.amount, l.reason AS label,
      CASE
        WHEN l.bet_id IS NOT NULL THEN '/casino/' || l.bet_id
        WHEN l.kind IN ('slot') THEN '/casino/slot'
        WHEN l.kind IN ('raspadinha') THEN '/casino/raspadinha'
        WHEN l.kind = 'encomenda' THEN '/cofre/encomendas'
      END AS href
    FROM ledger l
    WHERE NOT l.archived AND (${userId}::int IS NULL OR l.user_id = ${userId}::int)
    ORDER BY l.created_at, l.id
  `) as LedgerLine[];
  return rows.map((r) => ({ ...r, at: new Date(r.at) }));
}

export async function memberStatement(userId: number): Promise<StatementLine[]> {
  let balance = 0;
  return (await ledgerLines(userId))
    .map((l) => {
      balance += l.amount;
      return { ...l, balance };
    })
    .reverse();
}

export async function treasuryStatement(): Promise<StatementLine[]> {
  const economy = await loadEconomy();
  const held = new Map<number, number>();
  let cofre = economy.supply;
  const lines: StatementLine[] = [];
  for (const l of await ledgerLines(null)) {
    const before = held.get(l.user_id) ?? 0;
    const after = before + l.amount;
    held.set(l.user_id, after);
    const delta = Math.max(before, 0) - Math.max(after, 0);
    if (delta === 0) continue;
    cofre += delta;
    lines.push({ ...l, amount: delta, label: `${l.name}: ${l.label}`, balance: cofre });
  }
  return lines.reverse();
}
