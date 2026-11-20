import { readFileSync } from "node:fs";
import { neon } from "@neondatabase/serverless";
import { requireDatabaseUrl } from "./env.mjs";

const sql = neon(requireDatabaseUrl());
const statements = readFileSync("schema.sql", "utf8")
  .split(/;\s*$/m)
  .map((s) => s.trim())
  .filter(Boolean);

for (const statement of statements) {
  await sql.query(statement);
}
console.log(`Schema aplicado (${statements.length} instruções).`);
