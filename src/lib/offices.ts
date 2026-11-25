import "server-only";
import { cache } from "react";
import { sql } from "./db";

export type Office = "presidente" | "tesoureiro" | "apostas";

export const OFFICES: readonly Office[] = ["presidente", "tesoureiro", "apostas"];

export const GOVERNMENT: readonly Office[] = ["presidente", "tesoureiro"];

export const OFFICE_LABEL: Record<Office, { title: string; emoji: string }> = {
  presidente: { title: "Presidente", emoji: "👑" },
  tesoureiro: { title: "Tesoureiro", emoji: "💰" },
  apostas: { title: "Gestor de Apostas", emoji: "🎲" },
};

export type OfficeHolder = { office: Office; user_id: number; name: string };

export const getOffices = cache(async (): Promise<Partial<Record<Office, OfficeHolder>>> => {
  const rows = (await sql`
    SELECT o.office, o.user_id, u.name FROM offices o JOIN users u ON u.id = o.user_id
  `) as OfficeHolder[];
  return Object.fromEntries(rows.map((r) => [r.office, r]));
});

export async function holds(office: Office, userId: number): Promise<boolean> {
  return (await getOffices())[office]?.user_id === userId;
}

export const LETTER_PUSH = {
  title: "📨 Correspondência do Gabinete",
  body: "Tens uma carta confidencial à tua espera no teu gabinete, no Cofre.",
  url: "/cofre",
} as const;

export const BOOKIE_PUSH = {
  title: "🎲 És o Gestor de Apostas",
  body: "A partir de agora só tu abres mesas no Casino. Vai lá abrir a primeira.",
  url: "/casino",
} as const;
