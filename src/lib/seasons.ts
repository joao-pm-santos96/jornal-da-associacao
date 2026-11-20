import "server-only";
import { cache } from "react";
import { sql } from "./db";

export type Season = "natal" | "anonovo" | "carnaval" | "cinzas" | "pascoa";

export const SEASON_INFO: Record<Season, { tag: string; emoji: string }> = {
  natal: { tag: "Edição de Natal", emoji: "🎄" },
  anonovo: { tag: "Edição de Ano Novo", emoji: "🥂" },
  carnaval: { tag: "Edição da Mascarada", emoji: "🎭" },
  cinzas: { tag: "Quarta-feira de Cinzas", emoji: "🎭" },
  pascoa: { tag: "Edição Pascal", emoji: "🐰" },
};

export const SEASON_REACTIONS: Record<Season, string[]> = {
  natal: ["🎄"],
  anonovo: ["🥂"],
  carnaval: ["🎭", "🥳"],
  cinzas: [],
  pascoa: ["🐣"],
};

const lisbonParts = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Europe/Lisbon",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});

export type LisbonTime = { year: number; month: number; day: number; hour: number; minute: number; date: string };

export function lisbon(d: Date): LisbonTime {
  const p = Object.fromEntries(lisbonParts.formatToParts(d).map((x) => [x.type, x.value]));
  const year = Number(p.year);
  const month = Number(p.month);
  const day = Number(p.day);
  return { year, month, day, hour: Number(p.hour), minute: Number(p.minute), date: `${p.year}-${p.month}-${p.day}` };
}

function isoDate(y: number, m: number, d: number): string {
  return new Date(Date.UTC(y, m - 1, d)).toISOString().slice(0, 10);
}

function addDays(date: string, days: number): string {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export function easterSunday(year: number): string {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return isoDate(year, month, day);
}

export function carnivalDays(year: number): string[] {
  const tuesday = addDays(easterSunday(year), -47);
  return [-3, -2, -1, 0].map((offset) => addDays(tuesday, offset));
}

export function seasonFor(now: Date): Season | null {
  const t = lisbon(now);
  if (t.month === 12 && t.day <= 26) return "natal";
  if ((t.month === 12 && t.day >= 27) || (t.month === 1 && t.day <= 6)) return "anonovo";
  const carnival = carnivalDays(t.year);
  if (carnival.includes(t.date)) return "carnaval";
  if (t.date === addDays(carnival[3], 1)) return "cinzas";
  const easter = easterSunday(t.year);
  if (t.date >= addDays(easter, -2) && t.date <= addDays(easter, 1)) return "pascoa";
  return null;
}

export const getFakeNow = cache(async (): Promise<Date | null> => {
  const rows = (await sql`SELECT value FROM settings WHERE key = 'fake_now'`) as { value: string }[];
  return rows[0] ? new Date(rows[0].value) : null;
});

export async function getNow(): Promise<Date> {
  return (await getFakeNow()) ?? new Date();
}

export async function getSeason(): Promise<Season | null> {
  return seasonFor(await getNow());
}

export function seededRandom(seed: string): () => number {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  let state = h >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function derangement<T>(items: T[], random: () => number): T[] | null {
  if (items.length < 2) return null;
  for (let attempt = 0; attempt < 100; attempt++) {
    const shuffled = [...items];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    if (shuffled.every((x, i) => x !== items[i])) return shuffled;
  }
  return [...items.slice(1), items[0]];
}
