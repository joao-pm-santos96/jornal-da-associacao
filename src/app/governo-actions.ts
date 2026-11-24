"use server";

import { revalidatePath } from "next/cache";
import { after } from "next/server";
import { sql } from "@/lib/db";
import { notifyDecree, notifyMovement, pushToUsers } from "@/lib/push";
import { debit, getBalances, getEconomy } from "@/lib/economy";
import { getRules } from "@/lib/rules";
import { requireUser } from "@/lib/auth";
import { getOffices, holds, OFFICES, type Office } from "@/lib/offices";
import { field, type FormState } from "@/lib/form";
import { grains } from "@/lib/grains";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const MAX_AMOUNT = 2_147_483_647;

export async function applyMovement(_prev: FormState, form: FormData): Promise<FormState> {
  const R = await getRules();
  const user = await requireUser();
  if (!(await holds("tesoureiro", user.id))) return { error: "Só o Tesoureiro mexe no Cofre." };
  const economy = await getEconomy();
  if (!economy.open) return { error: "O Cofre está fechado para obras." };
  const target = Number(field(form, "user_id"));
  const kind = field(form, "kind");
  const amount = Number(field(form, "amount"));
  const reason = field(form, "reason");
  if (!Number.isInteger(target) || target <= 0) return { error: "Escolhe o sócio." };
  if (kind !== "multa" && kind !== "subsidio") return { error: "Escolhe multa ou subsídio." };
  if (!Number.isInteger(amount) || amount < 1) return { error: "O valor tem de ser um número inteiro de grãos." };
  if (amount > MAX_AMOUNT) return { error: "Nem o Cofre do Estado tem tantos grãos de café. Escolhe um valor mais pequeno." };
  if (reason.length < 3 || reason.length > 140) return { error: "Indica o motivo (3 a 140 caracteres)." };
  const member = economy.balances.find((b) => b.user_id === target);
  if (!member) return { error: "Esse sócio não existe." };

  if (kind === "multa") {
    const fined = debit(member.balance, amount, R.debtFloor);
    if (fined === 0) return { error: `${member.name} já está no teto da dívida (${grains(R.debtFloor)} ☕). Não há mais por onde multar.` };
    await sql`
      INSERT INTO ledger (user_id, amount, reason, created_by, kind)
      VALUES (${target}, ${-fined}, ${reason}, ${user.id}, 'multa')
    `;
    if (target !== user.id) after(() => notifyMovement(target, -fined, reason));
    revalidatePath("/cofre");
    return {
      ok: fined < amount
        ? `Multa de ${fined} ☕ aplicada: o resto passava o teto da dívida (${grains(R.debtFloor)} ☕).`
        : "Multa aplicada. A justiça foi feita.",
    };
  }

  if (amount > economy.available) return { error: `O Cofre só tem ${Math.max(economy.available, 0)} ☕ disponíveis.` };
  const president = (await getOffices()).presidente;
  if (target === user.id && president && president.user_id !== user.id) {
    await sql`INSERT INTO subsidy_requests (user_id, amount, reason) VALUES (${user.id}, ${amount}, ${reason})`;
    after(() =>
      pushToUsers([president.user_id], {
        title: `💰 O Tesoureiro pede ${amount} ☕ para si`,
        body: `${reason} · Precisa do teu aval no Cofre.`,
        url: "/cofre",
      }),
    );
    revalidatePath("/cofre");
    return { ok: "Pedido enviado ao Presidente. Um subsídio a si próprio precisa de aval." };
  }
  await sql`
    INSERT INTO ledger (user_id, amount, reason, created_by, kind)
    VALUES (${target}, ${amount}, ${reason}, ${user.id}, 'subsidio')
  `;
  if (target !== user.id) after(() => notifyMovement(target, amount, reason));
  revalidatePath("/cofre");
  return { ok: "Subsídio atribuído." };
}

export async function decideSubsidy(requestId: number, approve: boolean): Promise<void> {
  const user = await requireUser();
  if (!(await holds("presidente", user.id))) return;
  if (approve) {
    const economy = await getEconomy();
    const [row] = (await sql`
      WITH r AS (
        UPDATE subsidy_requests SET status = 'approved', decided_by = ${user.id}, decided_at = now()
        WHERE id = ${requestId} AND status = 'pending' AND amount <= ${economy.available}
        RETURNING user_id, amount, reason
      ),
      l AS (
        INSERT INTO ledger (user_id, amount, reason, created_by, kind)
        SELECT user_id, amount, reason || ' (com aval do Presidente)', ${user.id}, 'subsidio' FROM r
      )
      SELECT user_id, amount FROM r
    `) as { user_id: number; amount: number }[];
    if (row) after(() => notifyMovement(row.user_id, row.amount, "O Presidente deu o aval ao teu subsídio."));
  } else {
    const [row] = (await sql`
      UPDATE subsidy_requests SET status = 'rejected', decided_by = ${user.id}, decided_at = now()
      WHERE id = ${requestId} AND status = 'pending'
      RETURNING user_id, amount
    `) as { user_id: number; amount: number }[];
    if (row) {
      after(() =>
        pushToUsers([row.user_id], { title: "💰 Subsídio recusado", body: `O Presidente não deu aval aos ${row.amount} ☕.`, url: "/cofre" }),
      );
    }
  }
  revalidatePath("/cofre");
}

export async function grantAmnesty(_prev: FormState, form: FormData): Promise<FormState> {
  const user = await requireUser();
  if (!(await holds("presidente", user.id))) return { error: "Só o Presidente pode decretar amnistias." };
  const target = field(form, "user_id");
  const debtors = (await getBalances()).filter((b) => b.balance < 0 && (target === "todos" || b.user_id === Number(target)));
  if (debtors.length === 0) return { error: "Não há dívidas para perdoar." };
  await sql`
    INSERT INTO ledger (user_id, amount, reason, created_by, kind)
    SELECT u, a, 'Amnistia presidencial', ${user.id}, 'amnistia'
    FROM unnest(${debtors.map((d) => d.user_id)}::int[], ${debtors.map((d) => -d.balance)}::int[]) AS t(u, a)
  `;
  const names = debtors.map((d) => d.name).join(", ");
  await sql`
    INSERT INTO decrees (author_id, title, body)
    VALUES (${user.id}, ${`Amnistia de dívidas: ${names}`},
      ${`Por decreto presidencial, são perdoadas as dívidas ao Cofre de ${names}. O Cofre não perde nada: esses grãos nunca lá entraram.`})
  `;
  after(() =>
    pushToUsers(
      debtors.map((d) => d.user_id),
      { title: "🕊️ Amnistia presidencial", body: "A tua dívida ao Cofre foi perdoada. Não te habitues.", url: "/cofre" },
    ),
  );
  revalidatePath("/", "layout");
  return { ok: `Amnistia decretada para ${names}.` };
}

export async function createDecree(_prev: FormState, form: FormData): Promise<FormState> {
  const user = await requireUser();
  if (!(await holds("presidente", user.id))) return { error: "Só o Presidente pode decretar." };
  const title = field(form, "title");
  const body = field(form, "body");
  if (!title || title.length > 120) return { error: "O decreto precisa de um título (máx. 120 caracteres)." };
  if (!body || body.length > 2000) return { error: "O decreto precisa de texto (máx. 2000 caracteres)." };
  await sql`INSERT INTO decrees (author_id, title, body) VALUES (${user.id}, ${title}, ${body})`;
  after(() => notifyDecree(user.id, title));
  revalidatePath("/", "layout");
  return { ok: "Decreto publicado. Cumpra-se." };
}

export async function revokeDecree(decreeId: number): Promise<void> {
  const user = await requireUser();
  if (!(await holds("presidente", user.id))) return;
  await sql`UPDATE decrees SET revoked_at = now() WHERE id = ${decreeId} AND office = 'presidente' AND revoked_at IS NULL`;
  revalidatePath("/", "layout");
}

export async function pardonSlot(weekStart: string): Promise<void> {
  const user = await requireUser();
  if (!(await holds("presidente", user.id)) || !DATE_RE.test(weekStart)) return;
  await sql`
    WITH s AS (
      UPDATE rota_slots SET pardoned = true
      WHERE week_start = ${weekStart} AND NOT pardoned
        AND now() >= (week_start + 7)::timestamp AT TIME ZONE 'Europe/Lisbon'
      RETURNING user_id
    )
    INSERT INTO ledger (user_id, amount, reason, created_by, kind)
    SELECT l.user_id, -l.amount, 'Indulto presidencial: devolução da multa da escala', ${user.id}, 'estorno'
    FROM ledger l JOIN s ON s.user_id = l.user_id
    WHERE NOT l.archived AND l.kind = 'multa' AND l.created_by IS NULL
      AND l.reason = ${`Escala: falta na semana de ${weekStart.slice(8, 10)}/${weekStart.slice(5, 7)}`}
  `;
  revalidatePath("/", "layout");
}

export async function setOffice(_prev: FormState, form: FormData): Promise<FormState> {
  const user = await requireUser();
  if (!user.is_admin) return { error: "Sem permissões." };
  const office = field(form, "office") as Office;
  const target = field(form, "user_id");
  if (!OFFICES.includes(office)) return { error: "Cargo inválido." };
  if (target === "") {
    await sql`DELETE FROM offices WHERE office = ${office}`;
  } else {
    await sql`
      INSERT INTO offices (office, user_id) VALUES (${office}, ${Number(target)})
      ON CONFLICT (office) DO UPDATE SET user_id = EXCLUDED.user_id
    `;
  }
  revalidatePath("/", "layout");
  return { ok: "Cargo atualizado." };
}
