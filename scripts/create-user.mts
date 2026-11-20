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

const { values } = parseArgs({
  options: {
    email: { type: "string" },
    name: { type: "string" },
    admin: { type: "boolean", default: false },
  },
});

const email = values.email?.trim().toLowerCase();
const name = values.name?.trim();
if (!email || !email.includes("@") || !name) {
  console.error('Uso: npm run create-user -- --email x@y.pt --name "Nome" [--admin]');
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
  INSERT INTO users (email, name, password_hash, is_admin)
  VALUES (${email}, ${name}, ${hash}, ${values.admin})
  ON CONFLICT (email) DO UPDATE
    SET name = EXCLUDED.name, password_hash = EXCLUDED.password_hash, is_admin = EXCLUDED.is_admin
  RETURNING id, (xmax = 0) AS created
`;
console.log(`${row.created ? "Criado" : "Atualizado"} utilizador #${row.id} (${name}${values.admin ? ", admin" : ""}).`);
