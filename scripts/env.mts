import { existsSync } from "node:fs";

export function requireDatabaseUrl(): string {
  if (!process.env.DATABASE_URL && existsSync(".env.local")) {
    process.loadEnvFile(".env.local");
  }
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.error("Falta DATABASE_URL (no ambiente ou em .env.local).");
    process.exit(1);
  }
  return url;
}
