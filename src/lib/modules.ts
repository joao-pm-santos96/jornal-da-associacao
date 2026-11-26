import "server-only";
import { cache } from "react";
import { sql } from "./db";

export const MODULES = {
  casino: { label: "Casino", closed: "O Casino está fechado por ordem da administração." },
  festas: { label: "Épocas festivas", closed: "As festas foram canceladas por ordem da administração." },
  encomendas: { label: "Encomendas de posts", closed: "As encomendas estão suspensas por ordem da administração." },
  slot: { label: "Casino · Slot machine", closed: "A slot machine está fechada por ordem da administração." },
  raspadinha: { label: "Casino · Raspadinha", closed: "A Raspadinha está fechada por ordem da administração." },
  patos: { label: "Casino · Corrida de Patos", closed: "A Corrida de Patos está fechada por ordem da administração." },
  duelos: { label: "Casino · Duelos", closed: "Os Duelos estão fechados por ordem da administração." },
  bilhar: { label: "Casino · Bilhar", closed: "O Bilhar está fechado por ordem da administração." },
  gatilho: { label: "Casino · Gatilho", closed: "O Gatilho está fechado por ordem da administração." },
  altobaixo: { label: "Casino · Alto ou Baixo", closed: "O Alto ou Baixo está fechado por ordem da administração." },
} as const;

export const CASINO_GAMES = ["slot", "raspadinha", "patos", "duelos", "bilhar", "gatilho", "altobaixo"] as const satisfies readonly (keyof typeof MODULES)[];
export type CasinoGame = (typeof CASINO_GAMES)[number];

export type Module = keyof typeof MODULES;

export const MODULE_KEYS = Object.keys(MODULES) as Module[];

export function isModule(value: string): value is Module {
  return Object.hasOwn(MODULES, value);
}

export const getClosedModules = cache(async (): Promise<Set<Module>> => {
  const rows = (await sql`SELECT substr(key, 16) AS module FROM settings WHERE key LIKE 'modulo_fechado:%'`) as { module: string }[];
  return new Set(rows.map((r) => r.module).filter(isModule));
});

export async function isOpen(module: Module): Promise<boolean> {
  return !(await getClosedModules()).has(module);
}

export async function gameClosed(game: CasinoGame): Promise<string | null> {
  const closed = await getClosedModules();
  if (closed.has("casino")) return MODULES.casino.closed;
  if (closed.has(game)) return MODULES[game].closed;
  return null;
}
