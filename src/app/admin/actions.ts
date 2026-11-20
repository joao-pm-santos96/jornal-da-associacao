"use server";

import { randomBytes } from "node:crypto";
import bcrypt from "bcryptjs";
import { revalidatePath } from "next/cache";
import { sql } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { USERNAME_RE, field, type FormState } from "@/lib/form";

export type CredentialsState = FormState & { username?: string; password?: string };

async function requireAdmin() {
  const user = await requireUser();
  if (!user.is_admin) throw new Error("Sem permissões");
  return user;
}

function temporaryPassword(): string {
  return randomBytes(9).toString("base64url");
}

export async function createUser(_prev: CredentialsState, form: FormData): Promise<CredentialsState> {
  await requireAdmin();
  const username = field(form, "username").toLowerCase();
  const name = field(form, "name");
  const isAdmin = form.get("is_admin") === "on";
  if (!USERNAME_RE.test(username)) {
    return { error: "Username inválido: 2 a 32 caracteres, só letras minúsculas, números, ponto, _ ou -." };
  }
  if (!name || name.length > 60) return { error: "O nome é obrigatório (máx. 60 caracteres)." };

  const password = temporaryPassword();
  const rows = (await sql`
    INSERT INTO users (username, name, password_hash, is_admin)
    VALUES (${username}, ${name}, ${await bcrypt.hash(password, 12)}, ${isAdmin})
    ON CONFLICT (username) DO NOTHING
    RETURNING id
  `) as { id: number }[];
  if (!rows[0]) return { error: `O username @${username} já existe.` };
  revalidatePath("/admin");
  return { ok: `Conta @${username} criada.`, username, password };
}

export async function resetPassword(userId: number): Promise<CredentialsState> {
  await requireAdmin();
  const password = temporaryPassword();
  const rows = (await sql`
    UPDATE users SET password_hash = ${await bcrypt.hash(password, 12)}
    WHERE id = ${userId}
    RETURNING username
  `) as { username: string }[];
  if (!rows[0]) return { error: "Utilizador não encontrado." };
  return { ok: `Nova password temporária para @${rows[0].username}.`, username: rows[0].username, password };
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export async function setRotaSlot(_prev: FormState, form: FormData): Promise<FormState> {
  await requireAdmin();
  const weekStart = field(form, "week_start");
  const userId = Number(field(form, "user_id"));
  if (!DATE_RE.test(weekStart)) return { error: "Escolhe a data de início da semana." };
  if (!Number.isInteger(userId) || userId <= 0) return { error: "Escolhe quem escreve." };
  const [check] = (await sql`SELECT extract(isodow FROM ${weekStart}::date) = 1 AS monday`) as { monday: boolean }[];
  if (!check.monday) return { error: "A semana tem de começar a uma segunda-feira." };
  await sql`
    INSERT INTO rota_slots (week_start, user_id) VALUES (${weekStart}, ${userId})
    ON CONFLICT (week_start) DO UPDATE SET user_id = EXCLUDED.user_id
  `;
  revalidatePath("/admin");
  return { ok: "Escala atualizada." };
}

export async function removeRotaSlot(weekStart: string): Promise<void> {
  await requireAdmin();
  if (!DATE_RE.test(weekStart)) return;
  await sql`DELETE FROM rota_slots WHERE week_start = ${weekStart}`;
  revalidatePath("/admin");
}
