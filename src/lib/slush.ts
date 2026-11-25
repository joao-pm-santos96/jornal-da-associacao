import "server-only";
import { randomInt } from "node:crypto";
import { sql } from "./db";
import { GRAOS, addDays, debit, weekOf } from "./economy";
import { getRules } from "./rules";

export const EXCUSE_MAX = 120;

export const REPRESENTATION = "Despesas de representação";

export type SlushState = {
  balance: number;
  washed: number;
  dirty: number;
  prescribesOn: string | null;
  risk: number;
  immune: boolean;
  desviou: boolean;
  denounced: boolean;
  history: { id: number; amount: number; kind: string; reason: string; created_at: Date }[];
};

export function auditRisk(balance: number): number {
  if (balance <= 0) return 0;
  return Math.min(GRAOS.auditMaxPct, GRAOS.auditBasePct + GRAOS.auditPerGrainPct * balance);
}

function prescriptionLimit(week: string): string {
  return addDays(week, -7 * GRAOS.slushPrescribeWeeks);
}

export async function slushState(ownerId: number, now: Date): Promise<SlushState> {
  const week = weekOf(now);
  const limit = prescriptionLimit(week);
  const [[row], history] = await Promise.all([
    sql`
      SELECT
        coalesce(sum(amount), 0)::int AS balance,
        coalesce(sum(-amount) FILTER (WHERE kind = 'lavagem' AND week_start = ${week}::date), 0)::int AS washed,
        coalesce(sum(amount) FILTER (WHERE kind IN ('desvio', 'recompensa') AND week_start > ${limit}::date), 0)::int AS recent,
        min(week_start) FILTER (WHERE kind IN ('desvio', 'recompensa') AND week_start > ${limit}::date)::text AS oldest,
        bool_or(kind = 'recompensa' AND week_start = ${week}::date) AS immune,
        bool_or(kind = 'desvio' AND week_start = ${week}::date) AS desviou,
        EXISTS (SELECT 1 FROM audits WHERE auditor_id = ${ownerId} AND kind = 'denuncia' AND week_start = ${week}::date) AS denounced
      FROM slush_moves WHERE owner_id = ${ownerId}
    `,
    sql`
      SELECT id, amount, kind, reason, created_at FROM slush_moves
      WHERE owner_id = ${ownerId} ORDER BY created_at DESC, id DESC LIMIT 50
    `,
  ]) as [{ balance: number; washed: number; recent: number; oldest: string | null; immune: boolean | null; desviou: boolean | null; denounced: boolean }[], SlushState["history"]];
  const dirty = Math.min(row.balance, row.recent);
  return {
    balance: row.balance,
    washed: row.washed,
    dirty,
    prescribesOn: dirty > 0 && row.oldest ? addDays(row.oldest, 7 * GRAOS.slushPrescribeWeeks) : null,
    risk: auditRisk(row.balance),
    immune: row.immune ?? false,
    desviou: row.desviou ?? false,
    denounced: row.denounced,
    history,
  };
}

export async function hasSlushHistory(userId: number): Promise<boolean> {
  const [row] = (await sql`SELECT EXISTS (SELECT 1 FROM slush_moves WHERE owner_id = ${userId}) AS any`) as { any: boolean }[];
  return row.any;
}

export async function representationTotal(): Promise<number> {
  const [row] = (await sql`
    SELECT coalesce(sum(amount), 0)::int AS total FROM slush_moves
    WHERE kind IN ('desvio', 'recompensa') AND created_at >= now() - make_interval(days => ${GRAOS.auditWindowDays})
  `) as { total: number }[];
  return row.total;
}

type Holder = { owner_id: number; balance: number; immune: boolean };

export async function slushHolders(now: Date): Promise<Holder[]> {
  const week = weekOf(now);
  return (await sql`
    SELECT owner_id, sum(amount)::int AS balance,
      coalesce(bool_or(kind = 'recompensa' AND week_start = ${week}::date), false) AS immune
    FROM slush_moves GROUP BY owner_id HAVING sum(amount) > 0
  `) as Holder[];
}

export function rollCaught(balance: number): boolean {
  return randomInt(100) < auditRisk(balance);
}

export type Busted = { culprit_id: number; recovered: number; fine: number };

export async function bust(
  culprit: Holder,
  source: "auditoria" | "denuncia",
  now: Date,
  reward: { user_id: number; amount: number; hidden: boolean } | null,
): Promise<Busted | null> {
  const week = weekOf(now);
  const [member] = (await sql`
    SELECT coalesce(sum(amount), 0)::int AS balance FROM ledger WHERE user_id = ${culprit.owner_id} AND NOT archived
  `) as { balance: number }[];
  const { debtFloor } = await getRules();
  const fine = debit(member.balance, Math.ceil((culprit.balance * GRAOS.slushFinePct) / 100), debtFloor);
  const queries = [
    sql`
      INSERT INTO slush_moves (owner_id, amount, kind, reason, week_start)
      SELECT ${culprit.owner_id}, -s.balance, 'confisco', 'Fundos desviados devolvidos ao Cofre', ${week}::date
      FROM (SELECT sum(amount)::int AS balance FROM slush_moves WHERE owner_id = ${culprit.owner_id}) s
      WHERE s.balance = ${culprit.balance}
      RETURNING id
    `,
    sql`
      INSERT INTO scandals (culprit_id, recovered, fine, source)
      SELECT ${culprit.owner_id}, ${culprit.balance}, ${fine}, ${source}
      WHERE (SELECT coalesce(sum(amount), 0) FROM slush_moves WHERE owner_id = ${culprit.owner_id}) = 0
    `,
  ];
  if (fine > 0) {
    queries.push(sql`
      INSERT INTO ledger (user_id, amount, reason, kind)
      SELECT ${culprit.owner_id}, ${-fine}, 'Multa por desvio de fundos', 'multa'
      WHERE (SELECT coalesce(sum(amount), 0) FROM slush_moves WHERE owner_id = ${culprit.owner_id}) = 0
    `);
  }
  if (reward && reward.amount > 0) {
    queries.push(
      reward.hidden
        ? sql`
            INSERT INTO slush_moves (owner_id, amount, kind, reason, week_start)
            SELECT ${reward.user_id}, ${reward.amount}, 'recompensa', ${`${REPRESENTATION}: Honorários de advogados`}, ${week}::date
            WHERE (SELECT coalesce(sum(amount), 0) FROM slush_moves WHERE owner_id = ${culprit.owner_id}) = 0
          `
        : sql`
            INSERT INTO ledger (user_id, amount, reason, kind)
            SELECT ${reward.user_id}, ${reward.amount}, 'Recompensa da auditoria', 'auditoria'
            WHERE (SELECT coalesce(sum(amount), 0) FROM slush_moves WHERE owner_id = ${culprit.owner_id}) = 0
          `,
    );
  }
  const [confisco] = (await sql.transaction(queries)) as { id: number }[][];
  return confisco.length > 0 ? { culprit_id: culprit.owner_id, recovered: culprit.balance, fine } : null;
}

export type Prescription = { owner_id: number; amount: number };

export async function runPrescriptions(now: Date): Promise<Prescription[]> {
  const week = weekOf(now);
  const limit = prescriptionLimit(week);
  return (await sql`
    WITH s AS (
      SELECT owner_id, sum(amount)::int AS balance,
        coalesce(sum(amount) FILTER (WHERE kind IN ('desvio', 'recompensa') AND week_start > ${limit}::date), 0)::int AS recent
      FROM slush_moves GROUP BY owner_id
    ),
    p AS (
      SELECT owner_id, balance - recent AS amount FROM s WHERE balance - recent > 0
    ),
    m AS (
      INSERT INTO slush_moves (owner_id, amount, kind, reason, week_start)
      SELECT owner_id, -amount, 'prescricao', 'Prescrição', ${week}::date FROM p
    ),
    l AS (
      INSERT INTO ledger (user_id, amount, reason, kind)
      SELECT owner_id, amount, 'Consultoria', 'consultoria' FROM p
    )
    SELECT owner_id, amount FROM p
  `) as Prescription[];
}

export type Scandal = { id: number; name: string; recovered: number; fine: number; source: "auditoria" | "denuncia"; created_at: Date };

export async function recentScandals(): Promise<Scandal[]> {
  return (await sql`
    SELECT id, member_label(culprit_id) AS name, recovered, fine, source, created_at FROM scandals
    WHERE created_at > now() - interval '3 days'
    ORDER BY created_at DESC
  `) as Scandal[];
}

export async function auditedThisWeek(userId: number, week: string): Promise<boolean> {
  const [row] = (await sql`
    SELECT EXISTS (SELECT 1 FROM audits WHERE auditor_id = ${userId} AND kind = 'auditoria' AND week_start = ${week}::date) AS done
  `) as { done: boolean }[];
  return row.done;
}

export async function readLetters(userId: number): Promise<Set<string>> {
  const rows = (await sql`SELECT office FROM office_letters WHERE user_id = ${userId}`) as { office: string }[];
  return new Set(rows.map((r) => r.office));
}
