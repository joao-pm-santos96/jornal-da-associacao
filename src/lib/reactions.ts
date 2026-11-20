import "server-only";
import { sql } from "./db";

export const REACTIONS = ["😂", "🔥", "💀", "🤡", "🧂"] as const;
export type Emoji = (typeof REACTIONS)[number];

export type ReactionSummary = { emoji: Emoji; names: string[]; mine: boolean };

type Row = { target_id: number; emoji: Emoji; names: string[]; mine: boolean };

function group(rows: Row[]): Map<number, ReactionSummary[]> {
  const byTarget = new Map<number, ReactionSummary[]>();
  for (const { target_id, ...summary } of rows) {
    byTarget.set(target_id, [...(byTarget.get(target_id) ?? []), summary]);
  }
  return byTarget;
}

export async function getPostReactions(postId: number, userId: number) {
  const [postRows, commentRows] = await Promise.all([
    sql`
      SELECT r.post_id AS target_id, r.emoji, array_agg(u.name ORDER BY r.created_at) AS names,
        bool_or(r.user_id = ${userId}) AS mine
      FROM post_reactions r
      JOIN users u ON u.id = r.user_id
      WHERE r.post_id = ${postId}
      GROUP BY r.post_id, r.emoji
    `,
    sql`
      SELECT r.comment_id AS target_id, r.emoji, array_agg(u.name ORDER BY r.created_at) AS names,
        bool_or(r.user_id = ${userId}) AS mine
      FROM comment_reactions r
      JOIN comments c ON c.id = r.comment_id
      JOIN users u ON u.id = r.user_id
      WHERE c.post_id = ${postId}
      GROUP BY r.comment_id, r.emoji
    `,
  ]);
  return {
    post: group(postRows as Row[]).get(postId) ?? [],
    comments: group(commentRows as Row[]),
  };
}

export function isEmoji(value: string): value is Emoji {
  return (REACTIONS as readonly string[]).includes(value);
}
