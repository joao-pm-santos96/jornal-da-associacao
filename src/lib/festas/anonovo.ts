import "server-only";
import { sql } from "../db";
import { lisbon } from "../seasons";

export function resolutionYear(now: Date): number {
  const t = lisbon(now);
  return t.month === 12 ? t.year + 1 : t.year;
}

export function resolutionsRevealed(year: number, now: Date): boolean {
  return lisbon(now).date >= `${year}-12-01`;
}

export function isNewYearMoment(now: Date): boolean {
  const t = lisbon(now);
  return t.month === 1 && t.day === 1 && t.hour === 0;
}

export function reviewYear(now: Date): number {
  const t = lisbon(now);
  return t.month === 12 ? t.year : t.year - 1;
}

type Named = { name: string; value: number };

export type Retrospective = {
  year: number;
  posts: number;
  comments: number;
  reactions: number;
  decrees: string[];
  fines: number;
  topPost: { id: number; title: string; name: string; value: number } | null;
  topWriter: Named | null;
  topCommenter: Named | null;
  funniest: Named | null;
  laugher: Named | null;
  fastestReader: Named | null;
  rotaDone: number;
  rotaTotal: number;
  casino: Named[];
};

async function first<T>(query: Promise<Record<string, unknown>[]>): Promise<T | null> {
  return ((await query) as T[])[0] ?? null;
}

export async function getRetrospective(year: number): Promise<Retrospective> {
  const from = `${year}-01-01`;
  const to = `${year + 1}-01-01`;
  const inYear = (column: string) =>
    `${column} >= '${from}'::timestamp AT TIME ZONE 'Europe/Lisbon' AND ${column} < '${to}'::timestamp AT TIME ZONE 'Europe/Lisbon'`;
  const [totals, decrees, topPost, topWriter, topCommenter, funniest, laugher, fastestReader, rota, casino] = await Promise.all([
    first<{ posts: number; comments: number; reactions: number; fines: number }>(
      sql.query(`
        SELECT
          (SELECT count(*) FROM visible_posts p WHERE ${inYear("p.publish_at")})::int AS posts,
          (SELECT count(*) FROM comments c WHERE ${inYear("c.created_at")})::int AS comments,
          ((SELECT count(*) FROM post_reactions r WHERE ${inYear("r.created_at")})
            + (SELECT count(*) FROM comment_reactions r WHERE ${inYear("r.created_at")}))::int AS reactions,
          coalesce((SELECT -sum(l.amount) FROM ledger l WHERE l.amount < 0 AND l.bet_id IS NULL AND ${inYear("l.created_at")}), 0)::int AS fines
      `),
    ),
    sql.query(`SELECT title FROM decrees d WHERE revoked_at IS NULL AND ${inYear("d.created_at")} ORDER BY created_at`),
    first<{ id: number; title: string; name: string; value: number }>(
      sql.query(`
        SELECT p.id, p.title, member_label(p.author_id) AS name, count(c.id)::int AS value
        FROM visible_posts p LEFT JOIN comments c ON c.post_id = p.id
        WHERE ${inYear("p.publish_at")}
        GROUP BY p.id, p.title, p.author_id, p.publish_at ORDER BY value DESC, p.publish_at LIMIT 1
      `),
    ),
    first<Named>(sql.query(`
      SELECT member_label(p.author_id) AS name, count(*)::int AS value FROM visible_posts p
      WHERE ${inYear("p.publish_at")} GROUP BY p.author_id ORDER BY value DESC LIMIT 1`)),
    first<Named>(sql.query(`
      SELECT member_label(c.author_id) AS name, count(*)::int AS value FROM comments c
      WHERE ${inYear("c.created_at")} GROUP BY c.author_id ORDER BY value DESC LIMIT 1`)),
    first<Named>(sql.query(`
      SELECT member_label(x.author_id) AS name, count(*)::int AS value FROM (
        SELECT p.author_id, r.created_at FROM post_reactions r JOIN posts p ON p.id = r.post_id
          WHERE r.emoji = '😂' AND r.user_id <> p.author_id
        UNION ALL
        SELECT c.author_id, r.created_at FROM comment_reactions r JOIN comments c ON c.id = r.comment_id
          WHERE r.emoji = '😂' AND r.user_id <> c.author_id
      ) x WHERE ${inYear("x.created_at")} GROUP BY x.author_id ORDER BY value DESC LIMIT 1`)),
    first<Named>(sql.query(`
      SELECT member_label(x.user_id) AS name, count(*)::int AS value FROM (
        SELECT user_id, created_at FROM post_reactions WHERE emoji = '😂'
        UNION ALL SELECT user_id, created_at FROM comment_reactions WHERE emoji = '😂'
      ) x WHERE ${inYear("x.created_at")} GROUP BY x.user_id ORDER BY value DESC LIMIT 1`)),
    first<Named>(sql.query(`
      SELECT member_label(v.user_id) AS name, avg(extract(epoch FROM v.first_seen_at - p.publish_at))::float AS value
      FROM post_views v JOIN visible_posts p ON p.id = v.post_id
      WHERE v.user_id <> p.author_id AND v.first_seen_at >= p.publish_at AND ${inYear("p.publish_at")}
      GROUP BY v.user_id ORDER BY value ASC LIMIT 1`)),
    first<{ done: number; total: number }>(sql.query(`
      SELECT count(*) FILTER (WHERE EXISTS (
          SELECT 1 FROM visible_posts p WHERE p.author_id = r.user_id
            AND p.publish_at >= r.week_start::timestamp AT TIME ZONE 'Europe/Lisbon'
            AND p.publish_at < (r.week_start + 7)::timestamp AT TIME ZONE 'Europe/Lisbon'))::int AS done,
        count(*)::int AS total
      FROM rota_slots r
      WHERE r.week_start >= '${from}' AND r.week_start < '${to}'
        AND now() >= (r.week_start + 7)::timestamp AT TIME ZONE 'Europe/Lisbon'`)),
    sql.query(`
      SELECT member_label(l.user_id) AS name, sum(l.amount)::int AS value FROM ledger l
      WHERE l.bet_id IS NOT NULL AND ${inYear("l.created_at")}
      GROUP BY l.user_id ORDER BY value DESC`),
  ]);
  return {
    year,
    posts: totals?.posts ?? 0,
    comments: totals?.comments ?? 0,
    reactions: totals?.reactions ?? 0,
    fines: totals?.fines ?? 0,
    decrees: (decrees as { title: string }[]).map((d) => d.title),
    topPost,
    topWriter,
    topCommenter,
    funniest,
    laugher,
    fastestReader,
    rotaDone: rota?.done ?? 0,
    rotaTotal: rota?.total ?? 0,
    casino: casino as Named[],
  };
}

export type Resolution = {
  user_id: number;
  name: string;
  body: string;
  kept: number;
  broken: number;
  my_vote: boolean | null;
};

export async function getResolutions(year: number, viewerId: number): Promise<Resolution[]> {
  return (await sql`
    SELECT r.user_id, member_label(r.user_id) AS name, r.body,
      (SELECT count(*) FROM resolution_votes v WHERE v.year = r.year AND v.user_id = r.user_id AND v.kept)::int AS kept,
      (SELECT count(*) FROM resolution_votes v WHERE v.year = r.year AND v.user_id = r.user_id AND NOT v.kept)::int AS broken,
      (SELECT v.kept FROM resolution_votes v WHERE v.year = r.year AND v.user_id = r.user_id AND v.voter_id = ${viewerId})
        AS my_vote
    FROM resolutions r WHERE r.year = ${year} ORDER BY r.updated_at
  `) as Resolution[];
}
