"use server";

import bcrypt from "bcryptjs";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { sql } from "@/lib/db";
import { endSession, requireUser, startSession } from "@/lib/auth";
import { EDITION_RE } from "@/lib/dates";
import { field, type FormState } from "@/lib/form";
import { isEmoji } from "@/lib/reactions";
import { getBalances } from "@/lib/economy";

const DUMMY_HASH = "$2b$12$WBGkbrX6t1WgfJf4VEnO7O9cK.zOonkD1jusOwwfScTp1cGR3ToLO";
const LOCAL_DATETIME_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/;

export async function login(_prev: FormState, form: FormData): Promise<FormState> {
  const username = field(form, "username").toLowerCase();
  const password = String(form.get("password") ?? "");
  const rows = (await sql`SELECT id, password_hash FROM users WHERE username = ${username}`) as {
    id: number;
    password_hash: string;
  }[];
  const ok = await bcrypt.compare(password, rows[0]?.password_hash ?? DUMMY_HASH);
  if (!rows[0] || !ok) {
    await new Promise((r) => setTimeout(r, 500));
    return { error: "Utilizador ou password incorretos." };
  }
  await startSession(rows[0].id);
  redirect("/");
}

export async function logout(): Promise<void> {
  await endSession();
  redirect("/login");
}

export async function changeName(_prev: FormState, form: FormData): Promise<FormState> {
  const user = await requireUser();
  const name = field(form, "name");
  if (!name || name.length > 60) return { error: "O nome é obrigatório (máx. 60 caracteres)." };
  await sql`UPDATE users SET name = ${name} WHERE id = ${user.id}`;
  revalidatePath("/", "layout");
  return { ok: "Nome alterado." };
}

export async function changePassword(_prev: FormState, form: FormData): Promise<FormState> {
  const user = await requireUser();
  const current = String(form.get("current") ?? "");
  const next = String(form.get("next") ?? "");
  if (next.length < 8) return { error: "A nova password tem de ter pelo menos 8 caracteres." };
  if (next !== form.get("confirm")) return { error: "As passwords novas não coincidem." };
  const [row] = (await sql`SELECT password_hash FROM users WHERE id = ${user.id}`) as { password_hash: string }[];
  if (!(await bcrypt.compare(current, row.password_hash))) {
    await new Promise((r) => setTimeout(r, 500));
    return { error: "A password atual está errada." };
  }
  await sql`UPDATE users SET password_hash = ${await bcrypt.hash(next, 12)} WHERE id = ${user.id}`;
  return { ok: "Password alterada." };
}

export async function savePost(postId: number | null, _prev: FormState, form: FormData): Promise<FormState> {
  const user = await requireUser();
  const title = field(form, "title");
  const body = field(form, "body");
  const edition = field(form, "edition");
  const intent = field(form, "intent");
  const local = field(form, "publish_at");

  if (!title || title.length > 200) return { error: "O título é obrigatório (máx. 200 caracteres)." };
  if (!body || body.length > 50_000) return { error: "O texto é obrigatório (máx. 50 000 caracteres)." };
  if (!EDITION_RE.test(edition)) return { error: "A edição tem de estar no formato AAAA-MM." };

  const status = { draft: "draft", publish: "published", schedule: "scheduled" }[intent];
  if (!status) return { error: "Ação inválida." };
  let scheduleAt: string | null = null;
  if (status === "scheduled") {
    if (!LOCAL_DATETIME_RE.test(local)) return { error: "Escolhe a data e hora do agendamento." };
    const [check] = (await sql`
      SELECT (${local}::timestamp AT TIME ZONE 'Europe/Lisbon') > now() AS future
    `) as { future: boolean }[];
    if (!check.future) return { error: "A data do agendamento tem de ser no futuro." };
    scheduleAt = local;
  }

  let id: number;
  if (postId === null) {
    const [row] = (await sql`
      INSERT INTO posts (author_id, edition, title, body_md, status, publish_at)
      VALUES (${user.id}, ${edition}, ${title}, ${body}, ${status},
        CASE ${status}::text
          WHEN 'draft' THEN NULL
          WHEN 'published' THEN now()
          ELSE ${scheduleAt}::timestamp AT TIME ZONE 'Europe/Lisbon'
        END)
      RETURNING id
    `) as { id: number }[];
    id = row.id;
  } else {
    const rows = (await sql`
      UPDATE posts SET
        edition = ${edition},
        title = ${title},
        body_md = ${body},
        status = ${status},
        publish_at = CASE ${status}::text
          WHEN 'draft' THEN NULL
          WHEN 'published' THEN CASE WHEN status <> 'draft' AND publish_at <= now() THEN publish_at ELSE now() END
          ELSE ${scheduleAt}::timestamp AT TIME ZONE 'Europe/Lisbon'
        END,
        updated_at = now()
      WHERE id = ${postId} AND author_id = ${user.id}
      RETURNING id
    `) as { id: number }[];
    if (!rows[0]) return { error: "Post não encontrado." };
    id = rows[0].id;
  }
  redirect(`/post/${id}`);
}

export async function deletePost(postId: number): Promise<void> {
  const user = await requireUser();
  await sql`DELETE FROM posts WHERE id = ${postId} AND (author_id = ${user.id} OR ${user.is_admin})`;
  redirect("/");
}

export async function addComment(postId: number, form: FormData): Promise<void> {
  const user = await requireUser();
  const body = field(form, "body");
  if (!body || body.length > 2000) return;
  await sql`
    INSERT INTO comments (post_id, author_id, body)
    SELECT ${postId}, ${user.id}, ${body}
    WHERE EXISTS (SELECT 1 FROM visible_posts WHERE id = ${postId})
  `;
  revalidatePath(`/post/${postId}`);
}

export async function editComment(commentId: number, form: FormData): Promise<void> {
  const user = await requireUser();
  const body = field(form, "body");
  if (!body || body.length > 2000) return;
  const rows = (await sql`
    UPDATE comments SET body = ${body}
    WHERE id = ${commentId} AND author_id = ${user.id}
    RETURNING post_id
  `) as { post_id: number }[];
  if (rows[0]) revalidatePath(`/post/${rows[0].post_id}`);
}

export async function deleteComment(commentId: number): Promise<void> {
  const user = await requireUser();
  const rows = (await sql`
    DELETE FROM comments
    WHERE id = ${commentId} AND (author_id = ${user.id} OR ${user.is_admin})
    RETURNING post_id
  `) as { post_id: number }[];
  if (rows[0]) revalidatePath(`/post/${rows[0].post_id}`);
}

export async function toggleReaction(kind: "post" | "comment", targetId: number, emoji: string): Promise<void> {
  const user = await requireUser();
  if (!isEmoji(emoji)) return;
  if (emoji !== "🧂" && (await getBalances()).find((b) => b.user_id === user.id)?.frozen) return;
  if (kind === "post") {
    const deleted = await sql`
      DELETE FROM post_reactions WHERE post_id = ${targetId} AND user_id = ${user.id} AND emoji = ${emoji} RETURNING post_id
    `;
    if (deleted.length === 0) {
      await sql`
        INSERT INTO post_reactions (post_id, user_id, emoji)
        SELECT ${targetId}, ${user.id}, ${emoji}
        WHERE EXISTS (SELECT 1 FROM visible_posts WHERE id = ${targetId})
      `;
    }
    revalidatePath(`/post/${targetId}`);
    return;
  }
  const deleted = (await sql`
    DELETE FROM comment_reactions WHERE comment_id = ${targetId} AND user_id = ${user.id} AND emoji = ${emoji}
    RETURNING (SELECT post_id FROM comments WHERE id = ${targetId}) AS post_id
  `) as { post_id: number }[];
  let postId = deleted[0]?.post_id;
  if (postId === undefined) {
    const inserted = (await sql`
      INSERT INTO comment_reactions (comment_id, user_id, emoji)
      SELECT c.id, ${user.id}, ${emoji}
      FROM comments c
      WHERE c.id = ${targetId} AND EXISTS (SELECT 1 FROM visible_posts p WHERE p.id = c.post_id)
      RETURNING (SELECT post_id FROM comments WHERE id = ${targetId}) AS post_id
    `) as { post_id: number }[];
    postId = inserted[0]?.post_id;
  }
  if (postId !== undefined) revalidatePath(`/post/${postId}`);
}

export async function markPostViewed(postId: number): Promise<void> {
  const user = await requireUser();
  await sql`
    INSERT INTO post_views (post_id, user_id)
    SELECT ${postId}, ${user.id}
    WHERE EXISTS (SELECT 1 FROM visible_posts WHERE id = ${postId})
    ON CONFLICT (post_id, user_id) DO UPDATE SET last_seen_at = now()
  `;
}
