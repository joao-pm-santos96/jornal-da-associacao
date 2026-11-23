import "server-only";
import webpush from "web-push";
import { sql } from "./db";
import { GRAOS } from "./economy";

export type PushPayload = { title: string; body: string; url: string; tag?: string };

type StoredSubscription = { endpoint: string; p256dh: string; auth: string };

export function vapidPublicKey(): string | null {
  return process.env.VAPID_PUBLIC_KEY || null;
}

function vapidDetails(): { publicKey: string; privateKey: string; subject: string } | null {
  const publicKey = process.env.VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  const subject = process.env.VAPID_SUBJECT;
  return publicKey && privateKey && subject ? { publicKey, privateKey, subject } : null;
}

export async function pushToUsers(userIds: number[], payload: PushPayload): Promise<number> {
  const details = vapidDetails();
  if (!details || userIds.length === 0) return 0;
  const subs = (await sql`
    SELECT endpoint, p256dh, auth FROM push_subscriptions WHERE user_id = ANY(${userIds}::int[])
  `) as StoredSubscription[];
  const body = JSON.stringify(payload);
  const gone: string[] = [];
  let sent = 0;
  await Promise.all(
    subs.map(async (s) => {
      try {
        await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, body, {
          vapidDetails: details,
          TTL: 86_400,
        });
        sent++;
      } catch (err) {
        if (err instanceof webpush.WebPushError && (err.statusCode === 404 || err.statusCode === 410)) {
          gone.push(s.endpoint);
        } else {
          console.error("Falha ao enviar notificação push", err);
        }
      }
    }),
  );
  if (gone.length > 0) await sql`DELETE FROM push_subscriptions WHERE endpoint = ANY(${gone}::text[])`;
  return sent;
}

export async function pushToAllExcept(userId: number, payload: PushPayload): Promise<void> {
  const rows = (await sql`SELECT id FROM users WHERE id <> ${userId}`) as { id: number }[];
  await pushToUsers(rows.map((r) => r.id), payload);
}

function snippet(text: string, max = 120): string {
  const flat = text.replace(/\s+/g, " ").trim();
  return flat.length > max ? `${flat.slice(0, max - 1)}…` : flat;
}

export async function flushDueNotifications(): Promise<void> {
  const posts = (await sql`
    UPDATE posts SET notified_at = now()
    WHERE notified_at IS NULL AND status <> 'draft' AND publish_at <= now()
    RETURNING id, title, author_id, member_label(author_id) AS author, publish_at > now() - interval '2 days' AS fresh
  `) as { id: number; title: string; author_id: number; author: string; fresh: boolean }[];
  const slots = (await sql`
    UPDATE rota_slots SET notified_at = now()
    WHERE notified_at IS NULL
      AND week_start <= (now() AT TIME ZONE 'Europe/Lisbon')::date
      AND extract(hour FROM now() AT TIME ZONE 'Europe/Lisbon') >= 8
    RETURNING user_id, week_start::text AS week_start,
      week_start > (now() AT TIME ZONE 'Europe/Lisbon')::date - 7 AS current
  `) as { user_id: number; week_start: string; current: boolean }[];
  await Promise.all([
    ...posts
      .filter((p) => p.fresh)
      .map((p) =>
        pushToAllExcept(p.author_id, {
          title: `📰 ${p.author} publicou`,
          body: p.title,
          url: `/post/${p.id}`,
          tag: `post-${p.id}`,
        }),
      ),
    ...slots
      .filter((s) => s.current)
      .map((s) =>
        pushToUsers([s.user_id], {
          title: "✍️ Esta semana é a tua vez",
          body: `Estás na escala até domingo às 23:59. Publicar vale +${GRAOS.rotaDone} ☕, falhar custa −${GRAOS.rotaMissedFine} ☕.`,
          url: "/novo",
          tag: `escala-${s.week_start}`,
        }),
      ),
  ]);
}

export async function notifyComment(postId: number, commenterId: number, body: string): Promise<void> {
  const [row] = (await sql`
    SELECT p.title, member_label(${commenterId}) AS who,
      array(
        SELECT p.author_id UNION SELECT c.author_id FROM comments c WHERE c.post_id = p.id
        EXCEPT SELECT ${commenterId}::int
      ) AS targets
    FROM visible_posts p WHERE p.id = ${postId}
  `) as { title: string; who: string; targets: number[] }[];
  if (!row) return;
  await pushToUsers(row.targets, {
    title: `💬 ${row.who} comentou «${snippet(row.title, 60)}»`,
    body: snippet(body),
    url: `/post/${postId}`,
    tag: `comentarios-${postId}`,
  });
}

export async function notifyDecree(presidentId: number, title: string): Promise<void> {
  await pushToAllExcept(presidentId, { title: "📜 Novo Decreto Presidencial", body: title, url: "/decretos" });
}

export async function notifyMovement(targetId: number, amount: number, reason: string): Promise<void> {
  await pushToUsers([targetId], {
    title: amount < 0 ? `💰 Multa de ${-amount} ☕` : `💰 Subsídio de ${amount} ☕`,
    body: reason,
    url: "/cofre",
  });
}
