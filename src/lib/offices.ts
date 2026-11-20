import "server-only";
import { cache } from "react";
import { sql } from "./db";

export type Office = "presidente" | "tesoureiro";

export const OFFICE_LABEL: Record<Office, { title: string; emoji: string }> = {
  presidente: { title: "Presidente", emoji: "👑" },
  tesoureiro: { title: "Tesoureiro", emoji: "💰" },
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
