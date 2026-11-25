import "server-only";
import webpush from "web-push";
import { sql } from "./db";
import { getRules } from "./rules";
import { betResults } from "./bets";
import { resolveDueRaces, type RaceResult } from "./ducks";
import { duckName } from "./ducks-table";
import { expireDuels } from "./duels";
import { runBonuses, runPayrolls, settleCommissions } from "./payroll";
import { runPrescriptions } from "./slush";
import { getNow } from "./seasons";
import { purgeOldNotices, storeNotice } from "./notifications";

export type PushPayload = { title: string; body: string; url: string; tag?: string; inbox?: boolean };

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
  if (userIds.length === 0) return 0;
  const { inbox, ...message } = payload;
  if (inbox !== false) await storeNotice(userIds, message);
  const details = vapidDetails();
  if (!details) return 0;
  const subs = (await sql`
    SELECT endpoint, p256dh, auth FROM push_subscriptions WHERE user_id = ANY(${userIds}::int[])
  `) as StoredSubscription[];
  const body = JSON.stringify(message);
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

export async function notifyRaceResults(results: RaceResult[]): Promise<void> {
  const users = (await sql`SELECT id FROM users`) as { id: number }[];
  await Promise.all(
    results.flatMap((r) => {
      const winner = duckName(r.winner);
      const bettors = new Map(r.payouts.map((p) => [p.user_id, p]));
      return users.map((u) => {
        const p = bettors.get(u.id);
        const body = !p
          ? "Não apostaste. Para a semana há mais."
          : p.prize > 0
            ? `Apostaste ${p.staked} ☕ e recebeste ${p.prize} ☕. 🤑`
            : `Perdeste os ${p.staked} ☕ que apostaste. Patos não são de confiança.`;
        return pushToUsers([u.id], {
          title: `🦆 Corrida n.º ${r.id}: ganhou o ${winner}!`,
          body,
          url: "/casino/patos",
          tag: `corrida-${r.id}`,
        });
      });
    }),
  );
}

export async function settleRaces(): Promise<void> {
  await notifyRaceResults(await resolveDueRaces());
}

async function settleEconomy(): Promise<void> {
  const now = await getNow();
  const payrolls = await runPayrolls(now);
  const bonuses = await runBonuses(now);
  const commissions = await settleCommissions();
  await runPrescriptions(now);
  await Promise.all([
    ...payrolls.flatMap((p) =>
      p.notices
        .filter((n) => n.wage > 0 || n.fine > 0)
        .map((n) =>
          pushToUsers([n.user_id], {
            title: n.wage > 0 ? `💰 Ordenado da semana: +${n.wage} ☕` : `🚫 Multa da escala: −${n.fine} ☕`,
            body: [
              `${n.points} ${n.points === 1 ? "ponto" : "pontos"} na semana de ${p.week.slice(8, 10)}/${p.week.slice(5, 7)}.`,
              n.fine > 0 && n.wage > 0 && `Multa da escala −${n.fine} ☕.`,
              n.fee > 0 && `Cota −${n.fee} ☕.`,
            ]
              .filter(Boolean)
              .join(" "),
            url: "/cofre",
            tag: `ordenado-${p.week}`,
          }),
        ),
    ),
    ...bonuses.map((b) =>
      pushToAllExcept(0, {
        title: b.share > 0 ? `🎁 ${b.label}: +${b.share} ☕` : `✂️ ${b.label} cortado`,
        body: b.share > 0 ? "Pago pelo Cofre, a cada sócio." : "O Cofre não tem verba. A redação lamenta.",
        url: "/cofre",
        tag: b.key,
      }),
    ),
    ...commissions.map((c) =>
      pushToUsers([c.user_id], {
        title: c.outcome === "paid" ? `✍️ Encomenda paga: +${c.reward} ☕` : `↩️ Encomenda devolvida: +${c.reward} ☕`,
        body: c.outcome === "paid" ? `«${c.theme}»: o prazo acabou e o pagamento saiu.` : `Ninguém escreveu sobre «${c.theme}».`,
        url: "/cofre/encomendas",
        tag: `encomenda-${c.id}`,
      }),
    ),
  ]);
}

export async function flushDueNotifications(): Promise<void> {
  const R = await getRules();
  await settleEconomy();
  await settleRaces();
  await purgeOldNotices();
  const expired = await expireDuels();
  await Promise.all(
    expired.map((d) =>
      pushToUsers([d.challenger_id], {
        title: `⏰ ${d.opponent} não respondeu ao teu duelo`,
        body: `O desafio expirou e os ${d.stake} ☕ voltaram para ti.`,
        url: "/casino/duelos",
        tag: `duelo-${d.id}`,
      }),
    ),
  );
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
  const closing = (await sql`
    UPDATE bets SET closing_notified_at = now()
    WHERE status = 'open' AND closing_notified_at IS NULL AND closes_at > now()
      AND closes_at <= now() + make_interval(hours => ${R.betClosingWarningHours})
    RETURNING id, title
  `) as { id: number; title: string }[];
  const closed = (await sql`
    UPDATE bets SET closed_notified_at = now()
    WHERE status = 'open' AND closed_notified_at IS NULL AND closes_at <= now()
    RETURNING id, title, created_by AS banker
  `) as { id: number; title: string; banker: number | null }[];
  await Promise.all([
    ...closing.map((b) =>
      pushToAllExcept(0, {
        title: `⏳ Faltam menos de ${R.betClosingWarningHours} horas para fechar`,
        body: `Aposta n.º ${b.id}: ${b.title}`,
        url: `/casino/${b.id}`,
        tag: `aposta-${b.id}`,
      }),
    ),
    ...closed
      .filter((b) => b.banker !== null)
      .map((b) =>
        pushToUsers([b.banker!], {
          title: "🎰 Aposta fechada: declara o resultado",
          body: `Aposta n.º ${b.id}: ${b.title}`,
          url: `/casino/${b.id}`,
          tag: `aposta-${b.id}`,
        }),
      ),
    ...posts
      .filter((p) => p.fresh)
      .map((p) =>
        pushToAllExcept(p.author_id, {
          title: `📰 ${p.author} publicou`,
          body: p.title,
          url: `/post/${p.id}`,
          tag: `post-${p.id}`,
          inbox: false,
        }),
      ),
    ...slots
      .filter((s) => s.current)
      .map((s) =>
        pushToUsers([s.user_id], {
          title: "✍️ Esta semana é a tua vez",
          body: `Estás na escala até domingo às 23:59. Publicar vale +${R.rotaDone} pontos no ordenado, falhar custa −${R.rotaMissedFine} ☕.`,
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
    inbox: false,
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

export async function notifyNewBet(betId: number, bankerId: number, title: string): Promise<void> {
  const [row] = (await sql`SELECT member_label(${bankerId}) AS who`) as { who: string }[];
  await pushToAllExcept(bankerId, {
    title: `🎰 ${row.who} abriu a aposta n.º ${betId}`,
    body: title,
    url: `/casino/${betId}`,
    tag: `aposta-${betId}`,
  });
}

export async function notifyBetResult(betId: number, outcome: string): Promise<void> {
  const [bet] = (await sql`SELECT title FROM bets WHERE id = ${betId}`) as { title: string }[];
  if (!bet) return;
  const results = await betResults(betId);
  await Promise.all(
    results.map((r) => {
      const net = r.returned - r.staked;
      const body =
        outcome === "foi anulada"
          ? `Devolvemos-te os ${r.staked} ☕ que apostaste.`
          : r.returned > 0
            ? `Recebeste ${r.returned} ☕ (${net >= 0 ? "+" : "−"}${Math.abs(net)} ☕ de lucro). 🤑`
            : `Perdeste os ${r.staked} ☕ que apostaste. A banca agradece.`;
      return pushToUsers([r.user_id], {
        title: `🎰 Aposta n.º ${betId}: ${outcome}`,
        body: `${bet.title} · ${body}`,
        url: `/casino/${betId}`,
        tag: `aposta-${betId}`,
      });
    }),
  );
}
