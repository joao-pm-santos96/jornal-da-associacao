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
        WHEN l.kind = 'altobaixo' THEN '/casino/alto-baixo'
        WHEN l.kind = 'emprestimo' THEN '/cofre/emprestimos'
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

type SupplyChange = { at: Date; amount: number; label: string };

async function supplyChanges(): Promise<SupplyChange[]> {
  const rows = (await sql`
    SELECT created_at AS at, amount, reason AS label FROM supply_changes ORDER BY created_at, id
  `) as SupplyChange[];
  return rows.map((r) => ({ ...r, at: new Date(r.at) }));
}

type SlushLine = { id: number; user_id: number; name: string; at: Date; kind: string; amount: number; label: string };

async function slushLines(): Promise<SlushLine[]> {
  const rows = (await sql`
    SELECT s.id, s.owner_id AS user_id, member_label(s.owner_id) AS name, s.created_at AS at, s.kind, s.amount, s.reason AS label
    FROM slush_moves s
    WHERE s.kind IN ('desvio', 'recompensa', 'confisco')
    ORDER BY s.created_at, s.id
  `) as SlushLine[];
  return rows.map((r) => ({ ...r, at: new Date(r.at) }));
}

export async function treasuryStatement(): Promise<StatementLine[]> {
  const [economy, ledger, slush, changes] = await Promise.all([loadEconomy(), ledgerLines(null), slushLines(), supplyChanges()]);
  const events = [
    ...changes.map((c) => ({ source: "supply" as const, line: c })),
    ...ledger.map((l) => ({ source: "ledger" as const, line: l })),
    ...slush.map((s) => ({ source: "slush" as const, line: s })),
  ].sort((a, b) => a.line.at.getTime() - b.line.at.getTime());
  const held = new Map<number, number>();
  let cofre = economy.supply - changes.reduce((sum, c) => sum + c.amount, 0);
  const lines: StatementLine[] = [];
  for (const e of events) {
    if (e.source === "supply") {
      const c = e.line;
      cofre += c.amount;
      lines.push({ user_id: 0, name: "Cofre", at: c.at, kind: "injecao", amount: c.amount, label: c.label, href: null, balance: cofre });
      continue;
    }
    if (e.source === "slush") {
      const s = e.line;
      cofre -= s.amount;
      const confisco = s.kind === "confisco";
      lines.push({
        user_id: s.user_id,
        name: s.name,
        at: s.at,
        kind: confisco ? "confisco" : "representacao",
        amount: -s.amount,
        label: confisco ? `${s.name}: ${s.label}` : s.label,
        href: null,
        balance: cofre,
      });
      continue;
    }
    const l = e.line;
    const before = held.get(l.user_id) ?? 0;
    const after = before + l.amount;
    held.set(l.user_id, after);
    const delta = Math.max(before, 0) - Math.max(after, 0) + (l.kind === "consultoria" ? l.amount : 0);
    if (delta === 0) continue;
    cofre += delta;
    const prev = lines.at(-1);
    if ((l.kind === "oferta" || l.kind === "emprestimo") && prev?.kind === l.kind && prev.at.getTime() === l.at.getTime()) {
      prev.amount += delta;
      prev.balance = cofre;
      if (prev.amount === 0) lines.pop();
      continue;
    }
    lines.push({ ...l, amount: delta, label: `${l.name}: ${l.label}`, balance: cofre });
  }
  return lines.reverse();
}
