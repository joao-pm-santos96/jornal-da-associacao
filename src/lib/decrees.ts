import "server-only";
import { sql } from "./db";

export type Decree = {
  id: number;
  number: number;
  year: number;
  title: string;
  body: string;
  author: string;
  created_at: Date;
  revoked_at: Date | null;
};

export async function listDecrees(): Promise<Decree[]> {
  return (await sql`
    SELECT d.id, d.title, d.body, d.created_at, d.revoked_at, member_label(d.author_id) AS author,
      extract(year FROM d.created_at AT TIME ZONE 'Europe/Lisbon')::int AS year,
      row_number() OVER (
        PARTITION BY extract(year FROM d.created_at AT TIME ZONE 'Europe/Lisbon') ORDER BY d.created_at
      )::int AS number
    FROM decrees d
    ORDER BY d.created_at DESC
  `) as Decree[];
}

export async function latestDecree(maxAgeDays = 14): Promise<Decree | null> {
  const latest = (await listDecrees()).find((d) => !d.revoked_at);
  if (!latest) return null;
  return Date.now() - latest.created_at.getTime() <= maxAgeDays * 24 * 3600 * 1000 ? latest : null;
}
