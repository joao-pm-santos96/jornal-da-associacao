"use server";

import { revalidatePath } from "next/cache";
import { after } from "next/server";
import { sql } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { GIFT_REASON_MAX, TIP_OPTIONS, getEconomy, weekOf } from "@/lib/economy";
import { getRules } from "@/lib/rules";
import { field, type FormState } from "@/lib/form";
import { pushToUsers } from "@/lib/push";
import { getNow } from "@/lib/seasons";
import { MODULES, isOpen } from "@/lib/modules";

async function spendCheck(userId: number, price: number): Promise<string | null> {
  const economy = await getEconomy();
  if (!economy.open) return "O Cofre está fechado para obras.";
  const balance = economy.balances.find((b) => b.user_id === userId)?.balance ?? 0;
  if (balance < price) return `Custa ${price} ☕ e tens ${balance} ☕.`;
  return null;
}

export async function tip(kind: "post" | "comment", targetId: number, amount: number): Promise<FormState> {
  const R = await getRules();
  const user = await requireUser();
  if (!TIP_OPTIONS.includes(amount as (typeof TIP_OPTIONS)[number])) return { error: "Valor inválido." };
  const problem = await spendCheck(user.id, amount);
  if (problem) return { error: problem };
  const vat = Math.round((amount * R.tipVatPct) / 100);
  const [row] = (await sql`
    WITH t AS (
      SELECT p.author_id, p.id AS post_id, 'post «' || p.title || '»' AS what
      FROM visible_posts p WHERE ${kind} = 'post' AND p.id = ${targetId}
      UNION ALL
      SELECT c.author_id, c.post_id, 'comentário em «' || p.title || '»'
      FROM comments c JOIN visible_posts p ON p.id = c.post_id WHERE ${kind} = 'comment' AND c.id = ${targetId}
    ),
    ok AS (SELECT * FROM t WHERE author_id <> ${user.id}),
    l AS (
      INSERT INTO ledger (user_id, amount, reason, kind)
      SELECT ${user.id}::int, ${-amount}::int, 'Gorjeta a ' || member_label(author_id) || ': ' || what, 'gorjeta' FROM ok
      UNION ALL
      SELECT author_id, ${amount - vat}::int, 'Gorjeta de ' || member_label(${user.id}) || ': ' || what
        || CASE WHEN ${vat} > 0 THEN ' (IVA ' || ${vat} || ' ☕ para o Cofre)' ELSE '' END, 'gorjeta'
      FROM ok WHERE ${amount - vat}::int > 0
    )
    SELECT author_id, post_id, what FROM ok
  `) as { author_id: number; post_id: number; what: string }[];
  if (!row) return { error: "Não se dão gorjetas a si próprio." };
  after(() =>
    pushToUsers([row.author_id], {
      title: `☕ ${user.name} pagou-te um café`,
      body: `+${amount - vat} ☕ pelo teu ${row.what}.`,
      url: `/post/${row.post_id}`,
    }),
  );
  revalidatePath(`/post/${row.post_id}`);
  revalidatePath("/", "layout");
  return { ok: `Pagaste ${amount} ☕ de café${vat > 0 ? `, dos quais ${vat} ☕ de IVA para o Cofre` : ""}.` };
}

export async function buyHighlight(postId: number): Promise<FormState> {
  const R = await getRules();
  const user = await requireUser();
  const problem = await spendCheck(user.id, R.highlight);
  if (problem) return { error: problem };
  const [row] = (await sql`
    WITH p AS (SELECT id, title FROM visible_posts WHERE id = ${postId}),
    h AS (
      INSERT INTO post_highlights (post_id, buyer_id, until)
      SELECT p.id, ${user.id},
        greatest(now(), coalesce((SELECT max(until) FROM post_highlights WHERE post_id = p.id), now()))
          + make_interval(hours => ${R.highlightHours})
      FROM p
      RETURNING until
    ),
    l AS (
      INSERT INTO ledger (user_id, amount, reason, kind)
      SELECT ${user.id}, ${-R.highlight}, 'Loja: destaque do post «' || p.title || '»', 'loja' FROM p
    )
    SELECT until FROM h
  `) as { until: Date }[];
  if (!row) return { error: "Esse post não existe." };
  revalidatePath("/", "layout");
  return { ok: `Post em destaque na primeira página durante ${R.highlightHours} horas.` };
}

export async function buyPardon(): Promise<FormState> {
  const R = await getRules();
  const user = await requireUser();
  const problem = await spendCheck(user.id, R.pardon);
  if (problem) return { error: problem };
  const week = weekOf(await getNow());
  const [row] = (await sql`
    WITH s AS (
      UPDATE rota_slots r SET pardoned = true
      WHERE r.week_start = ${week}::date AND r.user_id = ${user.id} AND NOT r.pardoned
        AND now() < (r.week_start + 7)::timestamp AT TIME ZONE 'Europe/Lisbon'
        AND NOT EXISTS (
          SELECT 1 FROM visible_posts p WHERE p.author_id = r.user_id
            AND p.publish_at >= r.week_start::timestamp AT TIME ZONE 'Europe/Lisbon'
            AND p.publish_at < (r.week_start + 7)::timestamp AT TIME ZONE 'Europe/Lisbon'
        )
      RETURNING r.week_start
    ),
    l AS (
      INSERT INTO ledger (user_id, amount, reason, kind)
      SELECT ${user.id}, ${-R.pardon}, 'Loja: indulto da escala', 'loja' FROM s
    )
    SELECT week_start FROM s
  `) as { week_start: string }[];
  if (!row) return { error: "Só podes comprar o indulto na tua semana da escala, antes de publicares e antes de domingo acabar." };
  revalidatePath("/", "layout");
  return { ok: "Indulto comprado. Esta semana não há multa, nem pontos da escala." };
}

export async function buyNickname(_prev: FormState, form: FormData): Promise<FormState> {
  const R = await getRules();
  const user = await requireUser();
  const target = Number(field(form, "user_id"));
  const nickname = field(form, "nickname").replace(/\s+/g, " ");
  if (!Number.isInteger(target) || target <= 0) return { error: "Escolhe o sócio." };
  if (nickname.length < 2 || nickname.length > 30) return { error: "A alcunha tem de 2 a 30 caracteres." };
  const problem = await spendCheck(user.id, R.nickname);
  if (problem) return { error: problem };
  const [row] = (await sql`
    WITH u AS (SELECT id, name FROM users WHERE id = ${target}),
    n AS (
      INSERT INTO nicknames (user_id, buyer_id, nickname, until)
      SELECT id, ${user.id}, ${nickname}, now() + make_interval(days => ${R.nicknameDays}) FROM u
      RETURNING id
    ),
    l AS (
      INSERT INTO ledger (user_id, amount, reason, kind)
      SELECT ${user.id}, ${-R.nickname}, 'Loja: alcunha «' || ${nickname} || '» para ' || u.name, 'loja' FROM u
    )
    SELECT u.name FROM u
  `) as { name: string }[];
  if (!row) return { error: "Esse sócio não existe." };
  if (target !== user.id) {
    after(() =>
      pushToUsers([target], {
        title: `🏷️ Tens alcunha nova: «${nickname}»`,
        body: `Oferta de ${user.name}. Dura ${R.nicknameDays} dias.`,
        url: "/cofre",
      }),
    );
  }
  revalidatePath("/", "layout");
  return { ok: `${row.name} passa a ser «${nickname}» durante ${R.nicknameDays} dias.` };
}

export async function createCommission(_prev: FormState, form: FormData): Promise<FormState> {
  const R = await getRules();
  const user = await requireUser();
  if (!(await isOpen("encomendas"))) return { error: MODULES.encomendas.closed };
  const theme = field(form, "theme");
  const reward = Number(field(form, "reward"));
  const days = Number(field(form, "days"));
  if (theme.length < 3 || theme.length > 140) return { error: "Descreve o tema (3 a 140 caracteres)." };
  if (!Number.isInteger(reward) || reward < 1) return { error: "A recompensa é um número inteiro de grãos." };
  if (!Number.isInteger(days) || days < 1 || days > R.commissionMaxDays) {
    return { error: `O prazo vai de 1 a ${R.commissionMaxDays} dias.` };
  }
  const problem = await spendCheck(user.id, reward);
  if (problem) return { error: problem };
  const [row] = (await sql`
    WITH c AS (
      INSERT INTO commissions (requester_id, theme, reward, deadline)
      VALUES (${user.id}, ${theme}, ${reward}, now() + make_interval(days => ${days}))
      RETURNING id
    ),
    l AS (
      INSERT INTO ledger (user_id, amount, reason, kind)
      SELECT ${user.id}, ${-reward}, 'Encomenda n.º ' || id || ': «' || ${theme} || '» (fica retida)', 'encomenda' FROM c
    )
    SELECT id FROM c
  `) as { id: number }[];
  after(async () => {
    const others = (await sql`SELECT id FROM users WHERE id <> ${user.id}`) as { id: number }[];
    await pushToUsers(
      others.map((o) => o.id),
      { title: `✍️ ${user.name} encomendou um post: ${reward} ☕`, body: theme, url: "/cofre/encomendas", tag: `encomenda-${row.id}` },
    );
  });
  revalidatePath("/cofre/encomendas");
  return { ok: `Encomenda feita. Os ${reward} ☕ ficam retidos até alguém escrever.` };
}

export async function cancelCommission(id: number): Promise<void> {
  const user = await requireUser();
  await sql`
    WITH c AS (
      UPDATE commissions SET status = 'cancelled', resolved_at = now()
      WHERE id = ${id} AND requester_id = ${user.id} AND status = 'open'
      RETURNING id, reward
    )
    INSERT INTO ledger (user_id, amount, reason, kind)
    SELECT ${user.id}, reward, 'Encomenda n.º ' || id || ': cancelada, devolução', 'encomenda' FROM c
  `;
  revalidatePath("/cofre/encomendas");
}

export async function claimCommission(id: number, _prev: FormState, form: FormData): Promise<FormState> {
  const user = await requireUser();
  if (!(await isOpen("encomendas"))) return { error: MODULES.encomendas.closed };
  const postId = Number(field(form, "post_id"));
  if (!Number.isInteger(postId) || postId <= 0) return { error: "Escolhe o post que escreveste." };
  const [row] = (await sql`
    UPDATE commissions c SET status = 'claimed', post_id = ${postId}, author_id = ${user.id}
    WHERE c.id = ${id} AND c.status = 'open' AND c.requester_id <> ${user.id} AND c.deadline > now()
      AND EXISTS (SELECT 1 FROM visible_posts p WHERE p.id = ${postId} AND p.author_id = ${user.id} AND p.publish_at >= c.created_at)
    RETURNING c.requester_id, c.theme
  `) as { requester_id: number; theme: string }[];
  if (!row) return { error: "Não deu: a encomenda já não está aberta, ou o post não é teu ou é anterior à encomenda." };
  after(() =>
    pushToUsers([row.requester_id], {
      title: `✍️ ${user.name} entregou a tua encomenda`,
      body: `«${row.theme}» · Aceita ou recusa no Cofre. Sem resposta até ao prazo, paga-se sozinha.`,
      url: "/cofre/encomendas",
    }),
  );
  revalidatePath("/cofre/encomendas");
  return { ok: "Entrega registada. Agora decide quem encomendou." };
}

export async function decideCommission(id: number, accept: boolean): Promise<void> {
  const user = await requireUser();
  const [row] = (await sql`
    WITH c AS (
      UPDATE commissions SET
        status = CASE WHEN ${accept} THEN 'paid' ELSE 'open' END,
        resolved_at = CASE WHEN ${accept} THEN now() END,
        post_id = CASE WHEN ${accept} THEN post_id END,
        author_id = CASE WHEN ${accept} THEN author_id END
      WHERE id = ${id} AND requester_id = ${user.id} AND status = 'claimed'
      RETURNING id, reward, theme, (SELECT author_id FROM commissions WHERE id = ${id}) AS author_id
    ),
    l AS (
      INSERT INTO ledger (user_id, amount, reason, kind)
      SELECT author_id, reward, 'Encomenda n.º ' || id || ': «' || theme || '»', 'encomenda' FROM c WHERE ${accept}
    )
    SELECT author_id, reward, theme FROM c
  `) as { author_id: number; reward: number; theme: string }[];
  if (row) {
    after(() =>
      pushToUsers([row.author_id], {
        title: accept ? `✍️ Encomenda aceite: +${row.reward} ☕` : "✍️ Encomenda recusada",
        body: accept ? `«${row.theme}»` : `«${row.theme}» voltou a estar aberta.`,
        url: "/cofre/encomendas",
      }),
    );
  }
  revalidatePath("/cofre/encomendas");
}

export async function giveGrains(_prev: FormState, form: FormData): Promise<FormState> {
  const user = await requireUser();
  const target = Number(field(form, "user_id"));
  const amount = Number(field(form, "amount"));
  const reason = field(form, "reason").replace(/\s+/g, " ");
  if (!Number.isInteger(target) || target <= 0) return { error: "Escolhe o sócio." };
  if (target === user.id) return { error: "Dar grãos a ti próprio não conta." };
  if (!Number.isInteger(amount) || amount <= 0) return { error: "A quantia tem de ser um número inteiro de grãos." };
  if (reason.length < 2 || reason.length > GIFT_REASON_MAX) return { error: `Escreve o motivo (até ${GIFT_REASON_MAX} caracteres).` };
  const economy = await getEconomy();
  if (!economy.open) return { error: "O Cofre está fechado para obras." };
  const balance = economy.balances.find((b) => b.user_id === user.id)?.balance ?? 0;
  if (balance < amount) return { error: `Tens ${balance} ☕, não chega para dar ${amount} ☕.` };
  const [row] = (await sql`
    WITH u AS (
      SELECT id, name FROM users WHERE id = ${target}
        AND (SELECT coalesce(sum(amount), 0) FROM ledger WHERE user_id = ${user.id} AND NOT archived) >= ${amount}
    ),
    l AS (
      INSERT INTO ledger (user_id, amount, reason, kind)
      SELECT ${user.id}::int, ${-amount}::int, 'Oferta a ' || member_label(u.id) || ': ' || ${reason}, 'oferta' FROM u
      UNION ALL
      SELECT u.id, ${amount}::int, 'Oferta de ' || member_label(${user.id}) || ': ' || ${reason}, 'oferta' FROM u
    )
    SELECT u.name FROM u
  `) as { name: string }[];
  if (!row) return { error: "Não foi possível: confirma o sócio e o teu saldo." };
  after(() =>
    pushToUsers([target], {
      title: `💸 ${user.name} deu-te ${amount} ☕`,
      body: reason,
      url: "/cofre",
    }),
  );
  revalidatePath("/", "layout");
  return { ok: `Deste ${amount} ☕ a ${row.name}.` };
}
