import "server-only";
import { sql } from "../db";
import { carnivalDays, derangement, lisbon } from "../seasons";

export async function ensureMasks(day: string): Promise<void> {
  const [{ n }] = (await sql`SELECT count(*)::int AS n FROM carnival_masks WHERE day = ${day}`) as { n: number }[];
  if (n > 0) return;
  const ids = ((await sql`SELECT id FROM users ORDER BY id`) as { id: number }[]).map((u) => u.id);
  const masks = derangement(ids, Math.random);
  if (!masks) return;
  const rows = ids.map((user, i) => ({ user, mask: masks[i] }));
  await sql.query(
    `INSERT INTO carnival_masks (day, user_id, mask_id)
     SELECT $1::date, x.user, x.mask FROM json_to_recordset($2::json) AS x("user" int, mask int)
     ON CONFLICT DO NOTHING`,
    [day, JSON.stringify(rows)],
  );
}

export type MaskReveal = { day: string; person: string; disguise: string };

export async function lastCarnival(now: Date): Promise<{ days: string[]; over: boolean }> {
  const t = lisbon(now);
  let days = carnivalDays(t.year);
  if (t.date < days[0]) days = carnivalDays(t.year - 1);
  return { days, over: t.date > days[3] };
}

export async function getReveal(days: string[]): Promise<MaskReveal[]> {
  return (await sql`
    SELECT to_char(m.day, 'YYYY-MM-DD') AS day, u.name AS person, mu.name AS disguise
    FROM carnival_masks m JOIN users u ON u.id = m.user_id JOIN users mu ON mu.id = m.mask_id
    WHERE m.day = ANY(${days}::date[])
    ORDER BY m.day, u.name
  `) as MaskReveal[];
}
