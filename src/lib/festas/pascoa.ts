import "server-only";
import { sql } from "../db";
import { derangement, seededRandom } from "../seasons";

export const EGG_COUNT = 10;

export type EggSpot = { egg: number; path: string; top: number; left: number };

export async function eggSpots(year: number): Promise<EggSpot[]> {
  const [posts, editions] = await Promise.all([
    sql`SELECT id FROM visible_posts ORDER BY publish_at DESC LIMIT 4`,
    sql`SELECT DISTINCT edition FROM visible_posts ORDER BY edition DESC LIMIT 1`,
  ]);
  const paths = [
    "/", "/cofre", "/quadro", "/horoscopo", "/regras", "/decretos", "/meus", "/conta", "/novo", "/pascoa",
    ...(editions as { edition: string }[]).map((e) => `/edicao/${e.edition}`),
    ...(posts as { id: number }[]).map((p) => `/post/${p.id}`),
  ];
  const random = seededRandom(`ovos:${year}`);
  const pool = [...paths];
  const spots: EggSpot[] = [];
  for (let egg = 1; egg <= EGG_COUNT && pool.length > 0; egg++) {
    const [path] = pool.splice(Math.floor(random() * pool.length), 1);
    spots.push({ egg, path, top: 8 + Math.floor(random() * 80), left: 4 + Math.floor(random() * 88) });
  }
  return spots;
}

export async function foundEggs(year: number, userId: number): Promise<number[]> {
  const rows = (await sql`SELECT egg FROM easter_eggs WHERE year = ${year} AND user_id = ${userId}`) as {
    egg: number;
  }[];
  return rows.map((r) => r.egg);
}

export async function eggLeaderboard(year: number) {
  return (await sql`
    SELECT member_label(e.user_id) AS name, count(*)::int AS eggs, max(e.found_at) AS last
    FROM easter_eggs e WHERE e.year = ${year}
    GROUP BY e.user_id ORDER BY eggs DESC, last ASC
  `) as { name: string; eggs: number; last: Date }[];
}

export async function godparents(year: number): Promise<Map<number, { id: number; name: string }>> {
  const users = (await sql`SELECT id, name FROM users ORDER BY id`) as { id: number; name: string }[];
  const godparentsList = derangement(users, seededRandom(`folar:${year}`));
  const map = new Map<number, { id: number; name: string }>();
  if (!godparentsList) return map;
  users.forEach((u, i) => map.set(u.id, godparentsList[i]));
  return map;
}
