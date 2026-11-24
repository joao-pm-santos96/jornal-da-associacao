import { parseArgs } from "node:util";
import { createInterface } from "node:readline";
import bcrypt from "bcryptjs";
import { neon } from "@neondatabase/serverless";
import { requireDatabaseUrl } from "./env.mjs";

const rl = createInterface({ input: process.stdin, output: process.stdout, terminal: Boolean(process.stdin.isTTY) });
(rl as unknown as { _writeToOutput: (s: string) => void })._writeToOutput = () => {};
const lines = rl[Symbol.asyncIterator]();

async function askHidden(prompt: string): Promise<string> {
  process.stdout.write(prompt);
  const { value } = await lines.next();
  process.stdout.write("\n");
  return typeof value === "string" ? value : "";
}

import { USERNAME_RE } from "../src/lib/form.js";

const { values } = parseArgs({
  options: {
    username: { type: "string" },
    name: { type: "string" },
    admin: { type: "boolean", default: false },
  },
});

const username = values.username?.trim().toLowerCase();
const name = values.name?.trim();
if (!username || !USERNAME_RE.test(username) || !name) {
  console.error('Uso: npm run create-user -- --username joao --name "Nome" [--admin]  (username: 2-32 caracteres a-z 0-9 . _ -)');
  process.exit(1);
}

const password = await askHidden("Password: ");
if (password.length < 8) {
  console.error("A password tem de ter pelo menos 8 caracteres.");
  process.exit(1);
}
if ((await askHidden("Repete a password: ")) !== password) {
  console.error("As passwords não coincidem.");
  process.exit(1);
}
rl.close();

const sql = neon(requireDatabaseUrl());
const hash = await bcrypt.hash(password, 12);
const [row] = await sql`
  INSERT INTO users (username, name, password_hash, is_admin)
  VALUES (${username}, ${name}, ${hash}, ${values.admin})
  ON CONFLICT (username) DO UPDATE
    SET name = EXCLUDED.name, password_hash = EXCLUDED.password_hash, is_admin = EXCLUDED.is_admin
  RETURNING id, (xmax = 0) AS created
`;
console.log(`${row.created ? "Criado" : "Atualizado"} utilizador #${row.id} (${name}${values.admin ? ", admin" : ""}).`);

const WELCOME_KIT = 10;
if (row.created) {
  const [kit] = await sql`
    WITH state AS (
      SELECT (SELECT value FROM settings WHERE key = 'economia_massa')::int AS supply,
        (SELECT coalesce(sum(greatest(b, 0)), 0) FROM (
          SELECT sum(amount) AS b FROM ledger WHERE NOT archived GROUP BY user_id
        ) x)::int AS held
    )
    INSERT INTO ledger (user_id, amount, reason, kind, simulated)
    SELECT ${row.id}, ${WELCOME_KIT}, 'Kit de boas-vindas', 'kit', false FROM state
    WHERE EXISTS (SELECT 1 FROM settings WHERE key = 'economia_inicio') AND state.supply - state.held >= ${WELCOME_KIT}
    RETURNING id
  `;
  if (kit) console.log(`Kit de boas-vindas: +${WELCOME_KIT} ☕, pago pelo Cofre.`);
}
