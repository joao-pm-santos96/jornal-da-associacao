import { parseArgs } from "node:util";
import { neon } from "@neondatabase/serverless";
import { requireDatabaseUrl } from "./env.mjs";

const OPENING_BALANCE = 10;
const OPENING_COFRE = 100;

const { values } = parseArgs({
  options: {
    aplicar: { type: "boolean", default: false },
    "pontos-extra": { type: "string", multiple: true, default: [] },
  },
});

const extras = values["pontos-extra"].map((spec) => {
  const match = /^([a-z0-9._-]{2,32})=(\d+)$/.exec(spec);
  if (!match) {
    console.error(`Formato inválido em --pontos-extra "${spec}". Usa username=pontos, por exemplo tiago=15.`);
    process.exit(1);
  }
  return { username: match[1], points: Number(match[2]) };
});

const sql = neon(requireDatabaseUrl());

const [opened] = await sql`SELECT value FROM settings WHERE key = 'economia_inicio'`;
if (opened) {
  console.error(`A economia já foi aberta em ${opened.value}. Nada a fazer.`);
  process.exit(1);
}

const users = (await sql`SELECT id, username, name FROM users ORDER BY id`) as { id: number; username: string; name: string }[];
const byUsername = new Map(users.map((u) => [u.username, u]));
for (const e of extras) {
  if (!byUsername.has(e.username)) {
    console.error(`Não existe o utilizador "${e.username}".`);
    process.exit(1);
  }
}

const [pending] = await sql`
  SELECT
    (SELECT count(*) FROM ledger WHERE NOT archived)::int AS ledger_rows,
    (SELECT count(*) FROM bets WHERE status = 'open')::int AS open_bets,
    (SELECT count(*) FROM duck_bets d JOIN duck_races r ON r.id = d.race_id WHERE r.status = 'open')::int AS duck_bets,
    (SELECT count(*) FROM duels WHERE status = 'pending')::int AS pending_duels,
    date_trunc('week', now() AT TIME ZONE 'Europe/Lisbon')::date::text AS week
`;

console.log("Abertura da economia fechada\n");
console.log(`- Arquivar ${pending.ledger_rows} movimentos do livro antigo (ficam no histórico, deixam de contar).`);
console.log(`- Anular ${pending.open_bets} apostas em aberto, ${pending.duck_bets} apostas nos patos e ${pending.pending_duels} duelos pendentes.`);
console.log(`- Abertura de contas: +${OPENING_BALANCE} ☕ para cada um dos ${users.length} sócios.`);
console.log(`- Cofre abre com ${OPENING_COFRE} ☕ (massa monetária: ${OPENING_COFRE + OPENING_BALANCE * users.length} ☕).`);
for (const e of extras) {
  console.log(`- Pontos extra no ordenado da semana de ${pending.week}: ${byUsername.get(e.username)!.name}, ${e.points} pontos.`);
}

if (!values.aplicar) {
  console.log("\nSimulação: nada foi alterado. Corre outra vez com --aplicar para abrir a economia.");
  process.exit(0);
}

const supply = OPENING_COFRE + OPENING_BALANCE * users.length;
await sql.transaction([
  sql`UPDATE ledger SET archived = true WHERE NOT archived`,
  sql`UPDATE bets SET status = 'void', resolved_at = now() WHERE status = 'open'`,
  sql`DELETE FROM duck_bets WHERE race_id IN (SELECT id FROM duck_races WHERE status = 'open')`,
  sql`UPDATE duels SET status = 'void', resolved_at = now() WHERE status = 'pending'`,
  sql`
    INSERT INTO ledger (user_id, amount, reason, kind, simulated)
    SELECT id, ${OPENING_BALANCE}, 'Abertura de contas', 'abertura', false FROM users
  `,
  sql`
    INSERT INTO settings (key, value) VALUES
      ('economia_inicio', now()::text),
      ('economia_massa', ${String(supply)})
  `,
  ...extras.map(
    (e) => sql`
      INSERT INTO payroll_extra_points (week_start, user_id, points, reason)
      VALUES (${pending.week}::date, ${byUsername.get(e.username)!.id}, ${e.points}, 'Trabalho da semana anterior à abertura')
    `,
  ),
]);

console.log("\nEconomia aberta. Os saldos de cada sócio são agora:");
const rows = await sql`
  SELECT u.name, coalesce(sum(l.amount), 0)::int AS balance
  FROM users u LEFT JOIN ledger l ON l.user_id = u.id AND NOT l.archived
  GROUP BY u.id, u.name ORDER BY u.id
`;
for (const r of rows) console.log(`  ${r.name}: ${r.balance} ☕`);
console.log(`  Cofre: ${OPENING_COFRE} ☕`);
