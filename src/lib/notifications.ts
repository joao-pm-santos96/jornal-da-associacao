import "server-only";
import { sql } from "./db";
import { countUnread } from "./posts";

export const NOTICE_DAYS = 30;

export type Notice = { id: number; title: string; body: string; url: string; read_at: Date | null; created_at: Date };

export async function storeNotice(userIds: number[], notice: { title: string; body: string; url: string }): Promise<void> {
  await sql`
    INSERT INTO notifications (user_id, title, body, url)
    SELECT DISTINCT unnest(${userIds}::int[]), ${notice.title}, ${notice.body}, ${notice.url}
  `;
}

export async function listNotices(userId: number): Promise<Notice[]> {
  return (await sql`
    SELECT id, title, body, url, read_at, created_at FROM notifications
    WHERE user_id = ${userId} AND created_at > now() - make_interval(days => ${NOTICE_DAYS})
    ORDER BY created_at DESC, id DESC LIMIT 50
  `) as Notice[];
}

export async function countNews(userId: number): Promise<number> {
  const [posts, rows] = await Promise.all([
    countUnread(userId),
    sql`
      SELECT count(*)::int AS n FROM notifications
      WHERE user_id = ${userId} AND read_at IS NULL AND created_at > now() - make_interval(days => ${NOTICE_DAYS})
    `,
  ]);
  return posts + (rows as { n: number }[])[0].n;
}

export async function markNoticesRead(userId: number): Promise<void> {
  await sql`UPDATE notifications SET read_at = now() WHERE user_id = ${userId} AND read_at IS NULL`;
}

export async function purgeOldNotices(): Promise<void> {
  await sql`DELETE FROM notifications WHERE created_at < now() - make_interval(days => ${NOTICE_DAYS})`;
}
