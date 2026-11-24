import "server-only";
import { randomBytes } from "node:crypto";
import { sql } from "./db";
import {
  addDays,
  debit,
  lisbonMidnight,
  loadEconomy,
  payrollBudget,
  shortDate,
  splitByPoints,
  weekOf,
  weekPoints,
  type WeekPoints,
} from "./economy";
import { easterSunday, lisbon } from "./seasons";
import { loadRules, type Rules } from "./rules";
import { isOpen } from "./modules";

type LedgerRow = { user_id: number; amount: number; reason: string; kind: string };

export type PayrollNotice = { user_id: number; wage: number; points: number; fine: number; fee: number };

function pointsDetail(p: WeekPoints, R: Rules): string {
  const parts = [
    p.posts && `${p.posts} ${p.posts === 1 ? "post" : "posts"}`,
    p.comments && `${Math.min(p.comments, R.commentCap)} coment.`,
    p.laughs && `${Math.min(p.laughs, R.laughCap)} 😂`,
    p.rota === "done" && p.rota_points && "escala",
    p.extra && `${p.extra} extra`,
  ].filter(Boolean);
  return parts.join(", ");
}

function unnestRows(rows: LedgerRow[]) {
  return {
    ids: rows.map((r) => r.user_id),
    amounts: rows.map((r) => r.amount),
    reasons: rows.map((r) => r.reason),
    kinds: rows.map((r) => r.kind),
  };
}

async function payWeek(week: string, monday: string): Promise<PayrollNotice[] | null> {
  const economy = await loadEconomy();
  const R = await loadRules();
  if (!economy.start) return null;
  const weekLo = lisbonMidnight(week);
  const from = economy.start > weekLo ? economy.start : weekLo;
  const points = await weekPoints(week, from, lisbonMidnight(monday));
  const budget = payrollBudget(economy.available, R.payrollPct);
  const shares = splitByPoints(budget, new Map(points.map((p) => [p.user_id, p.points])), Math.random);
  const totalPoints = points.reduce((sum, p) => sum + p.points, 0);
  const balance = new Map(economy.balances.map((b) => [b.user_id, b.balance]));
  const created = new Map(economy.balances.map((b) => [b.user_id, lisbon(new Date(b.created_at)).date]));
  const rows: LedgerRow[] = [];
  const notices: PayrollNotice[] = [];

  for (const p of points) {
    let bal = balance.get(p.user_id) ?? 0;
    const wage = shares.get(p.user_id) ?? 0;
    if (wage > 0) {
      rows.push({
        user_id: p.user_id,
        amount: wage,
        reason: `Ordenado da semana de ${shortDate(week)}: ${p.points} ${p.points === 1 ? "ponto" : "pontos"} (${pointsDetail(p, R)})`,
        kind: "ordenado",
      });
      bal += wage;
    }
    let fine = 0;
    if (p.rota === "missed") {
      fine = debit(bal, R.rotaMissedFine, R.debtFloor);
      if (fine > 0) rows.push({ user_id: p.user_id, amount: -fine, reason: `Escala: falta na semana de ${shortDate(week)}`, kind: "multa" });
      bal -= fine;
    }
    let fee = 0;
    if ((created.get(p.user_id) ?? monday) < monday) {
      fee = debit(bal, R.weeklyFee, R.debtFloor);
      if (fee > 0) rows.push({ user_id: p.user_id, amount: -fee, reason: "Cota semanal", kind: "cota" });
      bal -= fee;
    }
    notices.push({ user_id: p.user_id, wage, points: p.points, fine, fee });
  }

  const token = randomBytes(12).toString("hex");
  const lines = points.filter((p) => p.points > 0 || shares.has(p.user_id));
  const r = unnestRows(rows);
  const [claimed] = await sql.transaction([
    sql`
      INSERT INTO payrolls (week_start, token, cofre_before, budget, total_points)
      VALUES (${week}, ${token}, ${economy.available}, ${budget}, ${totalPoints})
      ON CONFLICT (week_start) DO NOTHING
      RETURNING week_start
    `,
    sql`
      INSERT INTO payroll_lines (week_start, user_id, points, grains)
      SELECT ${week}::date, u, p, g
      FROM unnest(${lines.map((l) => l.user_id)}::int[], ${lines.map((l) => l.points)}::int[],
        ${lines.map((l) => shares.get(l.user_id) ?? 0)}::int[]) AS t(u, p, g)
      WHERE EXISTS (SELECT 1 FROM payrolls WHERE week_start = ${week}::date AND token = ${token})
    `,
    sql`
      INSERT INTO ledger (user_id, amount, reason, kind)
      SELECT u, a, r, k FROM unnest(${r.ids}::int[], ${r.amounts}::int[], ${r.reasons}::text[], ${r.kinds}::text[]) AS t(u, a, r, k)
      WHERE EXISTS (SELECT 1 FROM payrolls WHERE week_start = ${week}::date AND token = ${token})
    `,
  ]);
  return (claimed as unknown[]).length > 0 ? notices : null;
}

export async function runPayrolls(now: Date): Promise<{ week: string; notices: PayrollNotice[] }[]> {
  const economy = await loadEconomy();
  if (!economy.start) return [];
  const paid = new Set(
    ((await sql`SELECT week_start::text AS week FROM payrolls`) as { week: string }[]).map((r) => r.week),
  );
  const results: { week: string; notices: PayrollNotice[] }[] = [];
  for (let monday = addDays(weekOf(economy.start), 7); lisbonMidnight(monday) <= now; monday = addDays(monday, 7)) {
    const week = addDays(monday, -7);
    if (paid.has(week)) continue;
    const notices = await payWeek(week, monday);
    if (notices) results.push({ week, notices });
  }
  return results;
}

export type BonusNotice = { key: string; label: string; share: number };

export async function runBonuses(now: Date): Promise<BonusNotice[]> {
  const economy = await loadEconomy();
  const R = await loadRules();
  if (!economy.start || !(await isOpen("festas"))) return [];
  const startDate = lisbon(economy.start).date;
  const today = lisbon(now).date;
  const done = new Set(((await sql`SELECT key FROM bonus_payments`) as { key: string }[]).map((r) => r.key));
  const notices: BonusNotice[] = [];
  for (let year = lisbon(economy.start).year; year <= lisbon(now).year; year++) {
    const events = [
      { key: `natal-${year}`, date: `${year}-12-15`, pct: R.xmasPct, label: "Subsídio de Natal", kind: "natal" },
      { key: `folar-${year}`, date: easterSunday(year), pct: R.folarPct, label: "Folar da Páscoa", kind: "folar" },
    ];
    for (const e of events) {
      if (e.date < startDate || e.date > today || done.has(e.key)) continue;
      const fresh = await loadEconomy();
      const members = fresh.balances.map((b) => b.user_id);
      const share = members.length ? Math.floor(Math.floor((Math.max(fresh.available, 0) * e.pct) / 100) / members.length) : 0;
      const token = randomBytes(12).toString("hex");
      const [claimed] = await sql.transaction([
        sql`
          INSERT INTO bonus_payments (key, token, budget) VALUES (${e.key}, ${token}, ${share * members.length})
          ON CONFLICT (key) DO NOTHING RETURNING key
        `,
        sql`
          INSERT INTO ledger (user_id, amount, reason, kind)
          SELECT u, ${share}, ${`${e.label} ${year}`}, ${e.kind} FROM unnest(${members}::int[]) AS t(u)
          WHERE ${share} > 0 AND EXISTS (SELECT 1 FROM bonus_payments WHERE key = ${e.key} AND token = ${token})
        `,
      ]);
      if ((claimed as unknown[]).length > 0) notices.push({ key: e.key, label: e.label, share });
    }
  }
  return notices;
}

export type CommissionNotice = { id: number; theme: string; reward: number; user_id: number; outcome: "refunded" | "paid" };

export async function settleCommissions(): Promise<CommissionNotice[]> {
  return (await sql`
    WITH c AS (
      UPDATE commissions
      SET status = CASE WHEN status = 'claimed' THEN 'paid' ELSE 'refunded' END, resolved_at = now()
      WHERE status IN ('open', 'claimed') AND deadline <= now()
      RETURNING id, theme, reward, status, CASE WHEN status = 'paid' THEN author_id ELSE requester_id END AS user_id
    ),
    l AS (
      INSERT INTO ledger (user_id, amount, reason, kind)
      SELECT user_id, reward,
        CASE WHEN status = 'paid' THEN 'Encomenda n.º ' || id || ': pagamento (prazo acabou)'
          ELSE 'Encomenda n.º ' || id || ': ninguém pegou, devolução' END,
        'encomenda'
      FROM c WHERE user_id IS NOT NULL
    )
    SELECT id, theme, reward, user_id, CASE WHEN status = 'paid' THEN 'paid' ELSE 'refunded' END AS outcome
    FROM c WHERE user_id IS NOT NULL
  `) as CommissionNotice[];
}
