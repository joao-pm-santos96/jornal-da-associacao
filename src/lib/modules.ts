import "server-only";
import { cache } from "react";
import { sql } from "./db";

export const MODULES = {
  casino: { label: "Casino", closed: "O Casino está fechado por ordem da administração." },
  festas: { label: "Épocas festivas", closed: "As festas foram canceladas por ordem da administração." },
  encomendas: { label: "Encomendas de posts", closed: "As encomendas estão suspensas por ordem da administração." },
} as const;

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
