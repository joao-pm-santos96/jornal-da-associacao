import "server-only";
import { sql } from "./db";
import { ECONOMY_START, GRAOS, bonusEvents } from "./economy";
import { getNow } from "./seasons";

export type MovementKind = "post" | "comment" | "laugh" | "rota" | "rota_fine" | "fee" | "bonus" | "ledger";

export type HistoryEntry = {
  user_id: number;
  name: string;
  at: Date;
  kind: MovementKind;
  amount: number;
  label: string;
  href: string | null;
};

export type StatementLine = HistoryEntry & { balance: number };

const COFRE_KINDS: ReadonlySet<MovementKind> = new Set(["fee", "rota_fine", "bonus", "ledger"]);

async function activity(userId: number | null): Promise<HistoryEntry[]> {
  const rows = (await sql`
    WITH me AS (
      SELECT id, name, created_at FROM users WHERE ${userId}::int IS NULL OR id = ${userId}::int
    ),
    slots AS (
      SELECT r.user_id, r.week_start, r.pardoned,
        (SELECT min(p.publish_at) FROM visible_posts p
          WHERE p.author_id = r.user_id
            AND p.publish_at >= r.week_start::timestamp AT TIME ZONE 'Europe/Lisbon'
            AND p.publish_at < (r.week_start + 7)::timestamp AT TIME ZONE 'Europe/Lisbon') AS done_at,
        (r.week_start + 7)::timestamp AT TIME ZONE 'Europe/Lisbon' AS ends_at
      FROM rota_slots r WHERE r.user_id IN (SELECT id FROM me)
    )
    SELECT e.user_id, me.name, e.at, e.kind, e.amount::int AS amount, e.label, e.href
    FROM (
      SELECT p.author_id AS user_id, p.publish_at AS at, 'post' AS kind, ${GRAOS.post}::int AS amount,
        'Post «' || p.title || '»' AS label, '/post/' || p.id AS href
      FROM visible_posts p WHERE p.author_id IN (SELECT id FROM me)
      UNION ALL
      SELECT c.author_id, c.created_at, 'comment', ${GRAOS.comment}::int,
        'Comentário em «' || coalesce(p.title, '?') || '»', '/post/' || c.post_id
      FROM comments c LEFT JOIN posts p ON p.id = c.post_id WHERE c.author_id IN (SELECT id FROM me)
      UNION ALL
      SELECT p.author_id, r.created_at, 'laugh', ${GRAOS.laugh}::int,
        'Riso de ' || u.name || ' no post «' || p.title || '»', '/post/' || p.id
      FROM post_reactions r JOIN posts p ON p.id = r.post_id JOIN users u ON u.id = r.user_id
      WHERE p.author_id IN (SELECT id FROM me) AND r.user_id <> p.author_id AND r.emoji = '😂'
      UNION ALL
      SELECT c.author_id, r.created_at, 'laugh', ${GRAOS.laugh}::int,
        'Riso de ' || u.name || ' num comentário', '/post/' || c.post_id
      FROM comment_reactions r JOIN comments c ON c.id = r.comment_id JOIN users u ON u.id = r.user_id
      WHERE c.author_id IN (SELECT id FROM me) AND r.user_id <> c.author_id AND r.emoji = '😂'
      UNION ALL
      SELECT s.user_id, s.done_at, 'rota', ${GRAOS.rotaDone}::int,
        'Escala: semana de ' || to_char(s.week_start, 'DD/MM') || ' cumprida', NULL
      FROM slots s WHERE s.done_at IS NOT NULL
      UNION ALL
      SELECT s.user_id, s.ends_at, 'rota_fine', ${-GRAOS.rotaMissedFine}::int,
        'Escala: falta na semana de ' || to_char(s.week_start, 'DD/MM'), NULL
      FROM slots s WHERE s.done_at IS NULL AND NOT s.pardoned AND now() >= s.ends_at
      UNION ALL
      SELECT me.id, d::timestamp AT TIME ZONE 'Europe/Lisbon', 'fee', ${-GRAOS.weeklyFee}::int, 'Cota semanal', NULL
      FROM me, generate_series(
        greatest(${ECONOMY_START}::date, (me.created_at AT TIME ZONE 'Europe/Lisbon')::date),
        (jornal_now() AT TIME ZONE 'Europe/Lisbon')::date,
        interval '1 day') d
      WHERE extract(isodow FROM d) = 1
      UNION ALL
      SELECT l.user_id, l.created_at, 'ledger', l.amount, l.reason,
        CASE WHEN l.bet_id IS NOT NULL THEN '/casino/' || l.bet_id END
      FROM ledger l WHERE l.user_id IN (SELECT id FROM me)
    ) e JOIN me ON me.id = e.user_id
  `) as HistoryEntry[];

  const now = await getNow();
  const users = (await sql`
    SELECT id, name, created_at FROM users WHERE ${userId}::int IS NULL OR id = ${userId}::int
  `) as { id: number; name: string; created_at: Date }[];
  const bonuses: HistoryEntry[] = users.flatMap((u) =>
    bonusEvents(u.created_at, now).map((b) => ({
      user_id: u.id,
      name: u.name,
      at: new Date(`${b.date}T12:00:00Z`),
      kind: "bonus" as const,
      amount: b.amount,
      label: b.label,
      href: null,
    })),
  );
  return [...rows.map((r) => ({ ...r, at: new Date(r.at) })), ...bonuses];
}

function withRunningBalance(entries: HistoryEntry[]): StatementLine[] {
  const sorted = [...entries].sort((a, b) => a.at.getTime() - b.at.getTime());
  let balance = 0;
  const lines = sorted.map((e) => {
    balance += e.amount;
    return { ...e, balance };
  });
  return lines.reverse();
}

export async function memberStatement(userId: number): Promise<StatementLine[]> {
  return withRunningBalance(await activity(userId));
}

function groupBy<T>(items: T[], key: (item: T) => string): Map<string, T[]> {
  const groups = new Map<string, T[]>();
  for (const item of items) {
    const k = key(item);
    groups.set(k, [...(groups.get(k) ?? []), item]);
  }
  return groups;
}

export async function treasuryStatement(): Promise<StatementLine[]> {
  const flows = (await activity(null)).filter((e) => COFRE_KINDS.has(e.kind));
  const grouped = groupBy(
    flows.filter((e) => e.kind === "fee" || e.kind === "bonus"),
    (e) => `${e.kind}|${e.label}|${e.at.toISOString()}`,
  );
  const collective: HistoryEntry[] = [...grouped.values()].map((group) => {
    const first = group[0];
    const total = group.reduce((sum, e) => sum + e.amount, 0);
    const who = group.length === 1 ? first.name : `${group.length} sócios`;
    const label = first.kind === "fee" ? `Cotas da semana (${who})` : `${first.label} (${who})`;
    return { ...first, user_id: 0, name: "", amount: -total, label };
  });
  const individual: HistoryEntry[] = flows
    .filter((e) => e.kind === "rota_fine" || e.kind === "ledger")
    .map((e) => ({ ...e, amount: -e.amount, label: `${e.name}: ${e.label}` }));
  return withRunningBalance([...collective, ...individual]);
}
