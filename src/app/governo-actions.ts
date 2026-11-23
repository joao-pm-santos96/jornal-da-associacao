"use server";

import { revalidatePath } from "next/cache";
import { sql } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { holds, type Office } from "@/lib/offices";
import { field, type FormState } from "@/lib/form";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const MAX_AMOUNT = 2_147_483_647;

export async function applyMovement(_prev: FormState, form: FormData): Promise<FormState> {
  const user = await requireUser();
  if (!(await holds("tesoureiro", user.id))) return { error: "Só o Tesoureiro mexe no Cofre." };
  const target = Number(field(form, "user_id"));
  const kind = field(form, "kind");
  const amount = Number(field(form, "amount"));
  const reason = field(form, "reason");
  if (!Number.isInteger(target) || target <= 0) return { error: "Escolhe o sócio." };
  if (kind !== "multa" && kind !== "subsidio") return { error: "Escolhe multa ou subsídio." };
  if (!Number.isInteger(amount) || amount < 1) return { error: "O valor tem de ser um número inteiro de tremoços." };
  if (amount > MAX_AMOUNT) return { error: "Nem o Cofre do Estado tem tantos tremoços. Escolhe um valor mais pequeno." };
  if (reason.length < 3 || reason.length > 140) return { error: "Indica o motivo (3 a 140 caracteres)." };
  await sql`
    INSERT INTO ledger (user_id, amount, reason, created_by, simulated)
    SELECT id, ${kind === "multa" ? -amount : amount}, ${reason}, ${user.id}, false FROM users WHERE id = ${target}
  `;
  revalidatePath("/cofre");
  return { ok: kind === "multa" ? "Multa aplicada. A justiça foi feita." : "Subsídio atribuído." };
}

export async function createDecree(_prev: FormState, form: FormData): Promise<FormState> {
  const user = await requireUser();
  if (!(await holds("presidente", user.id))) return { error: "Só o Presidente pode decretar." };
  const title = field(form, "title");
  const body = field(form, "body");
  if (!title || title.length > 120) return { error: "O decreto precisa de um título (máx. 120 caracteres)." };
  if (!body || body.length > 2000) return { error: "O decreto precisa de texto (máx. 2000 caracteres)." };
  await sql`INSERT INTO decrees (author_id, title, body) VALUES (${user.id}, ${title}, ${body})`;
  revalidatePath("/", "layout");
  return { ok: "Decreto publicado. Cumpra-se." };
}

export async function revokeDecree(decreeId: number): Promise<void> {
  const user = await requireUser();
  if (!(await holds("presidente", user.id))) return;
  await sql`UPDATE decrees SET revoked_at = now() WHERE id = ${decreeId} AND revoked_at IS NULL`;
  revalidatePath("/", "layout");
}

export async function pardonSlot(weekStart: string): Promise<void> {
  const user = await requireUser();
  if (!(await holds("presidente", user.id)) || !DATE_RE.test(weekStart)) return;
  await sql`
    UPDATE rota_slots SET pardoned = true
    WHERE week_start = ${weekStart}
      AND now() >= (week_start + 7)::timestamp AT TIME ZONE 'Europe/Lisbon'
  `;
  revalidatePath("/", "layout");
}

export async function setOffice(_prev: FormState, form: FormData): Promise<FormState> {
  const user = await requireUser();
  if (!user.is_admin) return { error: "Sem permissões." };
  const office = field(form, "office") as Office;
  const target = field(form, "user_id");
  if (office !== "presidente" && office !== "tesoureiro") return { error: "Cargo inválido." };
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
