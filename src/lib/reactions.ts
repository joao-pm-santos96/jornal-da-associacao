import "server-only";
import { sql } from "./db";
import { SEASON_REACTIONS, type Season } from "./seasons";

export const REACTIONS = ["😂", "🔥", "💀", "🤡", "🧂"] as const;

const ALL_REACTIONS = new Set<string>([...REACTIONS, ...Object.values(SEASON_REACTIONS).flat()]);

export type ReactionSummary = { emoji: string; names: string[]; mine: boolean };

type Row = { target_id: number; emoji: string; names: string[]; mine: boolean };

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
      SELECT r.post_id AS target_id, r.emoji, array_agg(member_label(r.user_id) ORDER BY r.created_at) AS names,
        bool_or(r.user_id = ${userId}) AS mine
      FROM post_reactions r
      WHERE r.post_id = ${postId}
      GROUP BY r.post_id, r.emoji
    `,
    sql`
      SELECT r.comment_id AS target_id, r.emoji, array_agg(member_label(r.user_id) ORDER BY r.created_at) AS names,
        bool_or(r.user_id = ${userId}) AS mine
      FROM comment_reactions r
      JOIN comments c ON c.id = r.comment_id
      WHERE c.post_id = ${postId}
      GROUP BY r.comment_id, r.emoji
    `,
  ]);
  return {
    post: group(postRows as Row[]).get(postId) ?? [],
    comments: group(commentRows as Row[]),
  };
}

export function reactionOptions(season: Season | null): string[] {
  return [...REACTIONS, ...(season ? SEASON_REACTIONS[season] : [])];
}

export function isKnownEmoji(value: string): boolean {
  return ALL_REACTIONS.has(value);
}
