import "server-only";
import { sql } from "./db";
import { getNow, lisbon } from "./seasons";

export type Award = {
  emoji: string;
  title: string;
  description: string;
  winner: string | null;
  stat: string | null;
  href?: string;
};

type Row = { name: string; value: number; post_id?: number; title?: string };

function duration(seconds: number): string {
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.round(minutes / 60);
  if (hours < 48) return `${hours} h`;
  return `${Math.round(hours / 24)} dias`;
}

function plural(n: number, one: string, many: string): string {
  return `${n} ${n === 1 ? one : many}`;
}

async function top(query: Promise<Record<string, unknown>[]>): Promise<Row | null> {
  const rows = (await query) as Row[];
  return rows[0] ?? null;
}

export async function getAwards(): Promise<{ honor: Award[]; shame: Award[] }> {
  const year = lisbon(await getNow()).year;
  const [scoop, laughs, prolific, commenter, lightning, ghost, snail, missing, skipper, bunny, shark, wizard, broke] = await Promise.all([
    top(sql`
      SELECT member_label(u.id) AS name, p.id AS post_id, p.title, count(c.id)::int AS value
      FROM visible_posts p JOIN users u ON u.id = p.author_id
      JOIN comments c ON c.post_id = p.id
      GROUP BY p.id, p.title, u.id, p.publish_at
      ORDER BY value DESC, p.publish_at DESC LIMIT 1
    `),
    top(sql`
      SELECT member_label(u.id) AS name, count(*)::int AS value FROM (
        SELECT p.author_id AS user_id FROM post_reactions r JOIN posts p ON p.id = r.post_id
          WHERE r.emoji = '😂' AND r.user_id <> p.author_id
        UNION ALL
        SELECT c.author_id FROM comment_reactions r JOIN comments c ON c.id = r.comment_id
          WHERE r.emoji = '😂' AND r.user_id <> c.author_id
      ) x JOIN users u ON u.id = x.user_id
      GROUP BY u.id ORDER BY value DESC LIMIT 1
    `),
    top(sql`
      SELECT member_label(u.id) AS name, count(*)::int AS value FROM visible_posts p JOIN users u ON u.id = p.author_id
      GROUP BY u.id ORDER BY value DESC LIMIT 1
    `),
    top(sql`
      SELECT member_label(u.id) AS name, count(*)::int AS value FROM comments c JOIN users u ON u.id = c.author_id
      GROUP BY u.id ORDER BY value DESC LIMIT 1
    `),
    top(sql`
      SELECT member_label(u.id) AS name, avg(extract(epoch FROM v.first_seen_at - p.publish_at))::float AS value
      FROM post_views v JOIN visible_posts p ON p.id = v.post_id JOIN users u ON u.id = v.user_id
      WHERE v.first_seen_at >= p.publish_at AND v.user_id <> p.author_id
      GROUP BY u.id HAVING count(*) >= 1 ORDER BY value ASC LIMIT 1
    `),
    top(sql`
      SELECT member_label(u.id) AS name, count(p.id)::int AS value
      FROM users u JOIN visible_posts p ON p.author_id <> u.id
      WHERE NOT EXISTS (SELECT 1 FROM post_views v WHERE v.post_id = p.id AND v.user_id = u.id)
      GROUP BY u.id ORDER BY value DESC LIMIT 1
    `),
    top(sql`
      SELECT member_label(u.id) AS name, avg(extract(epoch FROM v.first_seen_at - p.publish_at))::float AS value
      FROM post_views v JOIN visible_posts p ON p.id = v.post_id JOIN users u ON u.id = v.user_id
      WHERE v.first_seen_at >= p.publish_at AND v.user_id <> p.author_id
      GROUP BY u.id HAVING count(*) >= 1 ORDER BY value DESC LIMIT 1
    `),
    top(sql`
      SELECT member_label(u.id) AS name, coalesce(extract(epoch FROM now() - max(p.publish_at)), -1)::float AS value
      FROM users u LEFT JOIN visible_posts p ON p.author_id = u.id
      GROUP BY u.id ORDER BY max(p.publish_at) ASC NULLS FIRST LIMIT 1
    `),
    top(sql`
      SELECT member_label(u.id) AS name, count(*)::int AS value
      FROM rota_slots r JOIN users u ON u.id = r.user_id
      WHERE now() >= (r.week_start + 7)::timestamp AT TIME ZONE 'Europe/Lisbon'
        AND NOT r.pardoned
        AND NOT EXISTS (
          SELECT 1 FROM visible_posts p WHERE p.author_id = r.user_id
            AND p.publish_at >= r.week_start::timestamp AT TIME ZONE 'Europe/Lisbon'
            AND p.publish_at < (r.week_start + 7)::timestamp AT TIME ZONE 'Europe/Lisbon'
        )
      GROUP BY u.id ORDER BY value DESC LIMIT 1
    `),
    top(sql`
      SELECT member_label(e.user_id) AS name, count(*)::int AS value
      FROM easter_eggs e WHERE e.year = ${year}
      GROUP BY e.user_id ORDER BY value DESC, max(e.found_at) ASC LIMIT 1
    `),
    top(sql`
      SELECT member_label(l.user_id) AS name, sum(l.amount)::int AS value
      FROM ledger l WHERE l.bet_id IS NOT NULL
      GROUP BY l.user_id HAVING sum(l.amount) > 0 ORDER BY value DESC LIMIT 1
    `),
    top(sql`
      SELECT member_label(w.user_id) AS name, count(DISTINCT w.bet_id)::int AS value
      FROM bet_wagers w JOIN bets b ON b.id = w.bet_id AND b.winning_option = w.option_id
      GROUP BY w.user_id ORDER BY value DESC, min(w.created_at) ASC LIMIT 1
    `),
    top(sql`
      SELECT member_label(l.user_id) AS name, -sum(l.amount)::int AS value
      FROM ledger l
      WHERE l.bet_id IS NOT NULL
        AND date_trunc('month', l.created_at AT TIME ZONE 'Europe/Lisbon') = date_trunc('month', now() AT TIME ZONE 'Europe/Lisbon')
      GROUP BY l.user_id HAVING sum(l.amount) < 0 ORDER BY value DESC LIMIT 1
    `),
  ]);

  return {
    honor: [
      {
        emoji: "🗞️", title: "Furo do Jornal", description: "O post que mais deu que falar",
        winner: scoop?.name ?? null, stat: scoop ? `«${scoop.title}» · ${plural(scoop.value, "comentário", "comentários")}` : null,
        href: scoop ? `/post/${scoop.post_id}` : undefined,
      },
      {
        emoji: "😂", title: "Palhaço de Serviço", description: "Mais 😂 recebidos dos outros",
        winner: laughs?.name ?? null, stat: laughs ? plural(laughs.value, "gargalhada", "gargalhadas") : null,
      },
      {
        emoji: "✍️", title: "Pena de Ouro", description: "Quem mais escreveu",
        winner: prolific?.name ?? null, stat: prolific ? plural(prolific.value, "post", "posts") : null,
      },
      {
        emoji: "🗣️", title: "Comentador Compulsivo", description: "Opinião sobre tudo e mais alguma coisa",
        winner: commenter?.name ?? null, stat: commenter ? plural(commenter.value, "comentário", "comentários") : null,
      },
      {
        emoji: "⚡", title: "Leitor Relâmpago", description: "Lê mais depressa depois de um post sair",
        winner: lightning?.name ?? null, stat: lightning ? `em média ${duration(lightning.value)}` : null,
      },
      {
        emoji: "🦈", title: "Tubarão", description: "Maior lucro nas apostas",
        winner: shark?.name ?? null, stat: shark ? `+${shark.value} ☕ de lucro` : null, href: "/casino",
      },
      {
        emoji: "🔮", title: "Bruxo", description: "Mais apostas acertadas",
        winner: wizard?.name ?? null, stat: wizard ? plural(wizard.value, "aposta certa", "apostas certas") : null, href: "/casino",
      },
      ...(bunny
        ? [{ emoji: "🐰", title: `Coelho do Ano ${year}`, description: "Mais ovos da Páscoa encontrados", winner: bunny.name, stat: plural(bunny.value, "ovo", "ovos") }]
        : []),
    ],
    shame: [
      {
        emoji: "👻", title: "Leitor Fantasma", description: "Mais posts por ler",
        winner: ghost?.name ?? null, stat: ghost ? plural(ghost.value, "post por ler", "posts por ler") : null,
      },
      {
        emoji: "🐌", title: "Leitor Caracol", description: "Demora mais a ler o que sai",
        winner: snail?.name ?? null, stat: snail ? `em média ${duration(snail.value)}` : null,
      },
      {
        emoji: "🕵️", title: "Desaparecido em Combate", description: "Há mais tempo sem escrever",
        winner: missing?.name ?? null,
        stat: missing ? (missing.value < 0 ? "nunca escreveu nada" : `último post há ${duration(missing.value)}`) : null,
      },
      {
        emoji: "💸", title: "Falido do Mês", description: "Mais grãos perdidos nas apostas este mês",
        winner: broke?.name ?? null, stat: broke ? `−${broke.value} ☕` : null, href: "/casino",
      },
      {
        emoji: "🚨", title: "Baldas da Escala", description: "Mais semanas da escala falhadas",
        winner: skipper?.name ?? null, stat: skipper ? plural(skipper.value, "semana em falta", "semanas em falta") : null,
      },
    ],
  };
}
