import "server-only";
import { sql } from "../db";
import { derangement, lisbon, seededRandom } from "../seasons";
import { TREMOCOS } from "../economy";

export function santaRevealed(year: number, now: Date): boolean {
  const t = lisbon(now);
  return `${t.date} ${String(t.hour).padStart(2, "0")}:${String(t.minute).padStart(2, "0")}` >= `${year}-12-24 20:00`;
}

export function consoada(year: number): string {
  return `${year}-12-24 20:00`;
}

export async function ensureSantaDraw(year: number): Promise<void> {
  const [{ drawn }] = (await sql`SELECT count(*)::int AS drawn FROM secret_santa WHERE year = ${year}`) as {
    drawn: number;
  }[];
  if (drawn > 0) return;
  const ids = ((await sql`SELECT id FROM users ORDER BY id`) as { id: number }[]).map((u) => u.id);
  const receivers = derangement(ids, Math.random);
  if (!receivers) return;
  const pairs = ids.map((giver, i) => ({ giver, receiver: receivers[i] }));
  await sql.query(
    `INSERT INTO secret_santa (year, giver_id, receiver_id)
     SELECT $1, giver, receiver FROM json_to_recordset($2::json) AS x(giver int, receiver int)
     ON CONFLICT DO NOTHING`,
    [year, JSON.stringify(pairs)],
  );
}

export type SantaCard = { id: number; body: string; created_at: Date; from_name: string; to_name: string };

export async function getSanta(year: number, userId: number, revealed: boolean) {
  const [mine, received, sent, pairs] = await Promise.all([
    sql`SELECT s.receiver_id, u.name FROM secret_santa s JOIN users u ON u.id = s.receiver_id
        WHERE s.year = ${year} AND s.giver_id = ${userId}`,
    sql`SELECT c.id, c.body, c.created_at, uf.name AS from_name, ut.name AS to_name
        FROM santa_cards c JOIN users uf ON uf.id = c.from_id JOIN users ut ON ut.id = c.to_id
        WHERE c.year = ${year} AND c.to_id = ${userId} ORDER BY c.created_at`,
    sql`SELECT c.id, c.body, c.created_at, uf.name AS from_name, ut.name AS to_name
        FROM santa_cards c JOIN users uf ON uf.id = c.from_id JOIN users ut ON ut.id = c.to_id
        WHERE c.year = ${year} AND c.from_id = ${userId} ORDER BY c.created_at`,
    revealed
      ? sql`SELECT ug.name AS giver, ur.name AS receiver FROM secret_santa s
            JOIN users ug ON ug.id = s.giver_id JOIN users ur ON ur.id = s.receiver_id
            WHERE s.year = ${year} ORDER BY ug.name`
      : Promise.resolve([]),
  ]);
  const receiver = (mine as { receiver_id: number; name: string }[])[0] ?? null;
  return {
    receiver,
    received: received as SantaCard[],
    sent: sent as SantaCard[],
    pairs: pairs as { giver: string; receiver: string }[],
  };
}

export function adventDay(now: Date): number | null {
  const t = lisbon(now);
  return t.month === 12 && t.day <= 24 ? t.day : null;
}

const HEADLINES = [
  "ÚLTIMA HORA: {nome} apanhado a comer as filhoses antes da consoada",
  "EXCLUSIVO: {nome} jura que este ano vai embrulhar os presentes com jeito",
  "ESCÂNDALO: {nome} visto a trocar o bolo-rei por um panettone",
  "FONTES CONFIRMAM: {nome} já tem a lista de presentes desde agosto",
  "POLÉMICA: {nome} defende que o bacalhau se come com ketchup",
  "ALERTA: {nome} prepara camisola de Natal com luzes que piscam",
];

const PROPHECIES = [
  "Este Natal vais receber meias. Muitas meias. Aceita o teu destino.",
  "Um presente inesperado espera por ti debaixo da árvore. Provavelmente é uma fatura.",
  "Os astros preveem que vais ficar com a fava do bolo-rei. Prepara a carteira.",
  "Vais comer mais rabanadas do que o recomendado pela Direção-Geral da Saúde.",
  "Alguém vai cantar desafinado na consoada. Há fortes indícios de que serás tu.",
  "A tua prenda vai ser a mais bonita… e a mais difícil de abrir.",
];

const JOKES = [
  "Porque é que o Pai Natal não usa telemóvel? Porque prefere o correio das renas.",
  "O que diz um peru otimista em dezembro? «Para o ano é que é!»",
  "Qual é o doce preferido dos programadores no Natal? Bolo-rei-start.",
  "Porque é que a árvore de Natal não sabe tricotar? Porque deixa cair as agulhas.",
  "O que é que o bacalhau disse à batata? «Contigo, até ao fim da consoada.»",
];

export type AdventSurprise = { kind: "tremocos" | "manchete" | "profecia" | "piada"; payload: string };

export function adventSurprise(year: number, door: number, userId: number, others: string[]): AdventSurprise {
  const random = seededRandom(`advento:${year}:${door}:${userId}`);
  const roll = random();
  const pick = <T,>(items: T[]) => items[Math.floor(random() * items.length)];
  if (roll < 0.3) {
    return { kind: "tremocos", payload: `Encontraste tremoços no sapatinho! +${TREMOCOS.adventPrize} 🫘` };
  }
  if (roll < 0.55 && others.length > 0) {
    return { kind: "manchete", payload: pick(HEADLINES).replace("{nome}", pick(others)) };
  }
  if (roll < 0.8) return { kind: "profecia", payload: pick(PROPHECIES) };
  return { kind: "piada", payload: pick(JOKES) };
}

export async function getAdventDoors(year: number, userId: number) {
  return (await sql`
    SELECT door, kind, payload FROM advent_doors WHERE year = ${year} AND user_id = ${userId} ORDER BY door
  `) as { door: number; kind: AdventSurprise["kind"]; payload: string }[];
}
