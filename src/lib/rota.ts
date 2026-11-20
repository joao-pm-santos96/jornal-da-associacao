import "server-only";
import { sql } from "./db";

export type RotaSlot = {
  week_start: string;
  user_id: number;
  name: string;
  state: "done" | "current" | "missed" | "pardoned" | "upcoming";
  deadline: Date;
  this_week: boolean;
  post_id: number | null;
  post_title: string | null;
};

export async function getRota() {
  return (await sql`
    SELECT to_char(r.week_start, 'YYYY-MM-DD') AS week_start, r.user_id, u.name,
      CASE
        WHEN p.id IS NOT NULL THEN 'done'
        WHEN r.pardoned THEN 'pardoned'
        WHEN now() >= (r.week_start + 7)::timestamp AT TIME ZONE 'Europe/Lisbon' THEN 'missed'
        WHEN now() >= r.week_start::timestamp AT TIME ZONE 'Europe/Lisbon' THEN 'current'
        ELSE 'upcoming'
      END AS state,
      (r.week_start + 7)::timestamp AT TIME ZONE 'Europe/Lisbon' AS deadline,
      (now() >= r.week_start::timestamp AT TIME ZONE 'Europe/Lisbon'
        AND now() < (r.week_start + 7)::timestamp AT TIME ZONE 'Europe/Lisbon') AS this_week,
      p.id AS post_id, p.title AS post_title
    FROM rota_slots r
    JOIN users u ON u.id = r.user_id
    LEFT JOIN LATERAL (
      SELECT v.id, v.title FROM visible_posts v
      WHERE v.author_id = r.user_id
        AND v.publish_at >= r.week_start::timestamp AT TIME ZONE 'Europe/Lisbon'
        AND v.publish_at < (r.week_start + 7)::timestamp AT TIME ZONE 'Europe/Lisbon'
      ORDER BY v.publish_at
      LIMIT 1
    ) p ON true
    ORDER BY r.week_start
  `) as RotaSlot[];
}
