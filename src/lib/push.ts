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
import { closeDueAssemblies, dueReminders, outcomeLabel, type ClosedAssembly } from "./assembly";
import { settlePoolGames } from "./pool-games";
import { settleReflexGames } from "./reflex-games";
import { settleLoans } from "./loans";
import { closeDueWeeks, getComedySchedule, openVoting, type ClosedComedy, type ComedySchedule } from "./comedy";

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

export async function notifyComedy(opened: { week: string; jokes: number } | null, closed: ClosedComedy[], schedule: ComedySchedule): Promise<void> {
  await Promise.all([
    ...(opened
      ? [
          pushToAllExcept(0, {
            title: "🎤 Abriu a votação do Comedy Club",
            body: `${opened.jokes === 1 ? "Há 1 piada" : `Há ${opened.jokes} piadas`} a concurso. Vota na melhor até às ${schedule.closes}h.`,
            url: "/comedy-club",
            tag: `comedy-${opened.week}`,
          }),
        ]
      : []),
    ...closed
      .filter((c) => c.winner_id !== null)
      .map((c) =>
        pushToAllExcept(0, {
          title: `🤡 ${c.winner} é o palhaço da semana`,
          body: `${c.body ? `«${snippet(c.body, 90)}» · ` : ""}${c.votes} ${c.votes === 1 ? "voto" : "votos"}${c.prize > 0 ? ` · +${c.prize} ☕` : ""}`,
          url: "/comedy-club",
          tag: `comedy-${c.week}`,
        }),
      ),
  ]);
}

async function settleComedy(): Promise<void> {
  const [now, R, schedule] = await Promise.all([getNow(), getRules(), getComedySchedule()]);
  const closed = await closeDueWeeks(now, R, schedule);
  const opened = await openVoting(now, schedule);
  await notifyComedy(opened, closed, schedule);
}

async function settlePool(): Promise<void> {
  const { expired, timedOut } = await settlePoolGames();
  await Promise.all([
    ...expired.map((g) =>
      pushToUsers([g.challenger_id], {
        title: "🎱 O teu desafio de bilhar expirou",
        body: g.stake > 0 ? `Ninguém pegou no taco. Os ${g.stake} ☕ voltaram para ti.` : "Ninguém pegou no taco.",
        url: "/casino/bilhar",
        tag: `bilhar-${g.id}`,
      }),
    ),
    ...timedOut.flatMap((g) => [
      pushToUsers([g.winner_id], {
        title: "🎱 Ganhaste por falta de comparência",
        body: g.prize > 0 ? `O adversário não jogou a tempo. +${g.prize} ☕` : "O adversário não jogou a tempo.",
        url: `/casino/bilhar/${g.id}`,
        tag: `bilhar-${g.id}`,
      }),
      pushToUsers([g.loser_id], {
        title: "🎱 Perdeste por falta de comparência",
        body: "Passou o prazo da tua jogada.",
        url: `/casino/bilhar/${g.id}`,
        tag: `bilhar-${g.id}`,
      }),
    ]),
  ]);
}

async function settleReflex(): Promise<void> {
  const { expired, timedOut } = await settleReflexGames();
  await Promise.all([
    ...expired.map((g) =>
      pushToUsers([g.challenger_id], {
        title: "⚡ O teu desafio do Gatilho expirou",
        body: g.stake > 0 ? `Ninguém aceitou. Os ${g.stake} ☕ voltaram para ti.` : "Ninguém aceitou.",
        url: "/casino/gatilho",
        tag: `gatilho-${g.id}`,
      }),
    ),
    ...timedOut.flatMap((g) => [
      pushToUsers([g.winner_id], {
        title: "⚡ Ganhaste o Gatilho por falta de comparência",
        body: g.prize > 0 ? `O adversário não jogou a tempo. +${g.prize} ☕` : "O adversário não jogou a tempo.",
        url: `/casino/gatilho/${g.id}`,
        tag: `gatilho-${g.id}`,
      }),
      pushToUsers([g.loser_id], {
        title: "⚡ Perdeste o Gatilho por falta de comparência",
        body: "Passou o prazo da tua vez.",
        url: `/casino/gatilho/${g.id}`,
        tag: `gatilho-${g.id}`,
      }),
    ]),
  ]);
}

async function settleLoanEvents(): Promise<void> {
  const url = "/cofre/emprestimos";
  const events = await settleLoans();
  await Promise.all(
    events.flatMap((e) => {
      const l = e.loan;
      const tag = `emprestimo-${l.id}`;
      const left = l.total - l.repaid;
      if (e.kind === "expired") {
        return [pushToUsers([l.lender_id], { title: "🤝 A tua proposta de empréstimo expirou", body: `${l.borrower} não respondeu. Os grãos nunca saíram.`, url, tag })];
      }
      if (e.kind === "reminder") {
        return [pushToUsers([l.borrower_id], { title: "🤝 O teu empréstimo vence amanhã", body: `Tens de devolver ${left} ☕ a ${l.lender}. Se não houver saldo, fica em incumprimento.`, url, tag })];
      }
      if (l.status === "repaid") {
        return [
          pushToUsers([l.lender_id], { title: `🤝 ${l.borrower} pagou o empréstimo`, body: `Recebeste ${e.paid} ☕ e o empréstimo está saldado.`, url, tag }),
          pushToUsers([l.borrower_id], { title: "🤝 Empréstimo saldado", body: `O Cofre cobrou ${e.paid} ☕ para ${l.lender}. Já não deves nada.`, url, tag }),
        ];
      }
      if (e.due) {
        return [
          pushToUsers([l.borrower_id], { title: "🚨 Empréstimo em incumprimento", body: `${e.paid > 0 ? `O Cofre cobrou ${e.paid} ☕. ` : ""}Faltam ${left} ☕ a ${l.lender}, cobrados sempre que entrarem grãos na tua conta.`, url, tag }),
          pushToUsers([l.lender_id], { title: `🚨 ${l.borrower} não pagou tudo a tempo`, body: `${e.paid > 0 ? `Recebeste ${e.paid} ☕. ` : ""}Faltam ${left} ☕, que vão sendo cobrados automaticamente.`, url, tag }),
        ];
      }
      return [pushToUsers([l.lender_id], { title: `🤝 Cobrados ${e.paid} ☕ a ${l.borrower}`, body: `Faltam ${left} ☕.`, url, tag })];
    }),
  );
}

export async function flushDueNotifications(): Promise<void> {
  const R = await getRules();
  await settleEconomy();
  await settleRaces();
  await purgeOldNotices();
  await settleAssemblies();
  await settlePool();
  await settleReflex();
  await settleLoanEvents();
  await settleComedy();
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

export async function notifyAssemblyResults(closed: ClosedAssembly[]): Promise<void> {
  await Promise.all(
    closed.map((a) =>
      pushToAllExcept(0, {
        title: `🗳️ Resultado: ${a.title}`,
        body: `${outcomeLabel(a)}. A ata está na Assembleia.`,
        url: `/assembleia/${a.id}`,
        tag: `assembleia-${a.id}`,
      }),
    ),
  );
}

export async function settleAssemblies(): Promise<void> {
  const [closed, reminders] = await Promise.all([closeDueAssemblies(), dueReminders()]);
  await Promise.all([
    notifyAssemblyResults(closed),
    ...reminders.map((r) =>
      pushToUsers(r.missing, {
        title: "⏰ Falta o teu voto na Assembleia",
        body: r.title,
        url: `/assembleia/${r.id}`,
        tag: `assembleia-${r.id}`,
      }),
    ),
  ]);
}

export async function notifyNewAssembly(id: number, creatorId: number, title: string): Promise<void> {
  const [row] = (await sql`SELECT member_label(${creatorId}) AS who`) as { who: string }[];
  await pushToAllExcept(creatorId, {
    title: `🗳️ ${row.who} convocou a Assembleia`,
    body: title,
    url: `/assembleia/${id}`,
    tag: `assembleia-${id}`,
  });
}

export async function notifyAssemblyComment(id: number, commenterId: number, body: string): Promise<void> {
  const [row] = (await sql`
    SELECT a.title, member_label(${commenterId}) AS who,
      array(
        SELECT a.created_by WHERE a.created_by IS NOT NULL
        UNION SELECT c.author_id FROM assembly_comments c WHERE c.assembly_id = a.id
        EXCEPT SELECT ${commenterId}::int
      ) AS targets
    FROM assemblies a WHERE a.id = ${id}
  `) as { title: string; who: string; targets: number[] }[];
  if (!row) return;
  await pushToUsers(row.targets, {
    title: `🗳️ ${row.who} no debate «${snippet(row.title, 60)}»`,
    body: snippet(body),
    url: `/assembleia/${id}`,
    tag: `assembleia-${id}`,
  });
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
