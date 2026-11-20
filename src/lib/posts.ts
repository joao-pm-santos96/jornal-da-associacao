import "server-only";
import { sql } from "./db";
import type { User } from "./auth";

export type PostSummary = {
  id: number;
  title: string;
  edition: string;
  body_md: string;
  publish_at: Date;
  author_name: string;
  comment_count: number;
};

export type Post = {
  id: number;
  author_id: number;
  author_name: string;
  edition: string;
  title: string;
  body_md: string;
  status: "draft" | "scheduled" | "published";
  publish_at: Date | null;
  visible: boolean;
};

export type Comment = {
  id: number;
  author_id: number;
  author_name: string;
  body: string;
  created_at: Date;
};

export type PendingPost = Pick<Post, "id" | "title" | "edition" | "status" | "publish_at" | "author_name">;

export async function listEditions() {
  return (await sql`
    SELECT edition, count(*)::int AS post_count
    FROM visible_posts
    GROUP BY edition
    ORDER BY edition DESC
  `) as { edition: string; post_count: number }[];
}

export async function listEditionPosts(edition: string) {
  return (await sql`
    SELECT p.id, p.title, p.edition, p.body_md, p.publish_at, u.name AS author_name,
      (SELECT count(*) FROM comments c WHERE c.post_id = p.id)::int AS comment_count
    FROM visible_posts p
    JOIN users u ON u.id = p.author_id
    WHERE p.edition = ${edition}
    ORDER BY p.publish_at DESC
  `) as PostSummary[];
}

export async function getPost(id: number) {
  const rows = (await sql`
    SELECT p.id, p.author_id, u.name AS author_name, p.edition, p.title, p.body_md, p.status, p.publish_at,
      (p.status <> 'draft' AND p.publish_at <= now()) AS visible
    FROM posts p
    JOIN users u ON u.id = p.author_id
    WHERE p.id = ${id}
  `) as Post[];
  return rows[0] ?? null;
}

export async function getEditablePost(id: number, userId: number) {
  const rows = (await sql`
    SELECT id, title, edition, body_md, status,
      to_char(publish_at AT TIME ZONE 'Europe/Lisbon', 'YYYY-MM-DD"T"HH24:MI') AS publish_at_local,
      (status <> 'draft' AND publish_at <= now()) AS visible
    FROM posts
    WHERE id = ${id} AND author_id = ${userId}
  `) as {
    id: number;
    title: string;
    edition: string;
    body_md: string;
    status: Post["status"];
    publish_at_local: string | null;
    visible: boolean;
  }[];
  return rows[0] ?? null;
}

export async function listComments(postId: number) {
  return (await sql`
    SELECT c.id, c.author_id, u.name AS author_name, c.body, c.created_at
    FROM comments c
    JOIN users u ON u.id = c.author_id
    WHERE c.post_id = ${postId}
    ORDER BY c.created_at
  `) as Comment[];
}

export async function listPending(user: User) {
  return (await sql`
    SELECT p.id, p.title, p.edition, p.status, p.publish_at, u.name AS author_name
    FROM posts p
    JOIN users u ON u.id = p.author_id
    WHERE NOT (p.status <> 'draft' AND p.publish_at <= now())
      AND (p.author_id = ${user.id} OR ${user.is_admin})
    ORDER BY p.publish_at NULLS FIRST, p.updated_at DESC
  `) as PendingPost[];
}

export function excerpt(md: string, length = 180): string {
  const text = md
    .replace(/<[^>]*>/g, "")
    .replace(/^\s*\|?[\s:|-]+\|[\s:|-]*$/gm, "")
    .replace(/!\[[^\]]*\]\([^)]*\)/g, "")
    .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/[#>*_`~|-]/g, "")
    .replace(/\s+/g, " ")
    .trim();
  return text.length > length ? `${text.slice(0, length).trimEnd()}…` : text;
}
