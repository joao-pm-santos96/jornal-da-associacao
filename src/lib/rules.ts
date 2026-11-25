import "server-only";
import { cache } from "react";
import { sql } from "./db";
import { GRAOS } from "./graos";

export type RuleUnit = "☕" | "%" | "pontos" | "h" | "dias" | "vezes" | "apostadores";

type RuleDef = { group: string; label: string; unit: RuleUnit; min: number; max: number };

const MAX = 1_000_000;

export const RULE_DEFS = {
  post: { group: "Ordenado", label: "Post publicado", unit: "pontos", min: 0, max: MAX },
  comment: { group: "Ordenado", label: "Comentário", unit: "pontos", min: 0, max: MAX },
  commentCap: { group: "Ordenado", label: "Comentários que contam por semana", unit: "vezes", min: 0, max: MAX },
  laugh: { group: "Ordenado", label: "😂 recebido", unit: "pontos", min: 0, max: MAX },
  laughCap: { group: "Ordenado", label: "😂 que contam por semana", unit: "vezes", min: 0, max: MAX },
  rotaDone: { group: "Ordenado", label: "Escala cumprida", unit: "pontos", min: 0, max: MAX },
  payrollPct: { group: "Ordenado", label: "Ordenado semanal (do disponível no Cofre)", unit: "%", min: 0, max: 100 },
  weeklyFee: { group: "Cobranças", label: "Cota semanal", unit: "☕", min: 0, max: MAX },
  rotaMissedFine: { group: "Cobranças", label: "Multa por falhar a escala", unit: "☕", min: 0, max: MAX },
  debtFloor: { group: "Cobranças", label: "Teto da dívida (a conta congela aqui)", unit: "☕", min: -MAX, max: 0 },
  tipVatPct: { group: "Cobranças", label: "IVA das gorjetas", unit: "%", min: 0, max: 100 },
  highlight: { group: "Loja do Cofre", label: "Destaque na primeira página", unit: "☕", min: 0, max: MAX },
  highlightHours: { group: "Loja do Cofre", label: "Duração do destaque", unit: "h", min: 1, max: MAX },
  pardon: { group: "Loja do Cofre", label: "Indulto da escala", unit: "☕", min: 0, max: MAX },
  nickname: { group: "Loja do Cofre", label: "Alcunha", unit: "☕", min: 0, max: MAX },
  nicknameDays: { group: "Loja do Cofre", label: "Duração da alcunha", unit: "dias", min: 1, max: 3650 },
  commissionMaxDays: { group: "Loja do Cofre", label: "Prazo máximo das encomendas", unit: "dias", min: 1, max: 3650 },
  xmasPct: { group: "Festas", label: "Subsídio de Natal (do disponível)", unit: "%", min: 0, max: 100 },
  folarPct: { group: "Festas", label: "Folar da Páscoa (do disponível)", unit: "%", min: 0, max: 100 },
  adventPrize: { group: "Festas", label: "Prémio das portas do Advento", unit: "☕", min: 0, max: MAX },
  egg: { group: "Festas", label: "Ovo da Páscoa", unit: "☕", min: 0, max: MAX },
  welcomeKit: { group: "Festas", label: "Kit de boas-vindas a sócios novos", unit: "☕", min: 0, max: MAX },
  betHouseCutPct: { group: "Casino", label: "Parte da casa nas apostas", unit: "%", min: 0, max: 100 },
  betBankerFee: { group: "Casino", label: "Comissão máxima da banca", unit: "☕", min: 0, max: MAX },
  betBankerMinBettors: { group: "Casino", label: "Apostadores para a banca receber comissão", unit: "apostadores", min: 0, max: MAX },
  betClosingWarningHours: { group: "Casino", label: "Aviso antes de uma aposta fechar", unit: "h", min: 0, max: 720 },
  slotBet1: { group: "Casino", label: "Slot: ficha pequena", unit: "☕", min: 1, max: MAX },
  slotBet2: { group: "Casino", label: "Slot: ficha média", unit: "☕", min: 1, max: MAX },
  slotBet3: { group: "Casino", label: "Slot: ficha grande", unit: "☕", min: 1, max: MAX },
  scratchCost: { group: "Casino", label: "Raspadinha: preço do bilhete (os prémios são múltiplos)", unit: "☕", min: 1, max: MAX },
  raceHouseCutPct: { group: "Casino", label: "Corrida de patos: parte da casa", unit: "%", min: 0, max: 100 },
  duelHouseCutPct: { group: "Casino", label: "Duelos: parte da casa", unit: "%", min: 0, max: 100 },
  duelMinStake: { group: "Casino", label: "Duelos: aposta mínima", unit: "☕", min: 1, max: MAX },
  duelExpiryHours: { group: "Casino", label: "Duelos: prazo para responder", unit: "h", min: 1, max: 720 },
} as const satisfies Record<string, RuleDef>;

export type RuleKey = keyof typeof RULE_DEFS;
export type Rules = Record<RuleKey, number>;

export const RULE_KEYS = Object.keys(RULE_DEFS) as RuleKey[];

export function isRuleKey(key: string): key is RuleKey {
  return Object.hasOwn(RULE_DEFS, key);
}

export function defaultRules(): Rules {
  return Object.fromEntries(RULE_KEYS.map((k) => [k, GRAOS[k]])) as Rules;
}

export async function loadRules(): Promise<Rules> {
  const rules = defaultRules();
  const rows = (await sql`SELECT key, value FROM economy_rules`) as { key: string; value: number }[];
  for (const r of rows) if (isRuleKey(r.key)) rules[r.key] = r.value;
  return rules;
}

export const getRules = cache(loadRules);

const SINGULAR: Partial<Record<RuleUnit, string>> = { pontos: "ponto", vezes: "vez", dias: "dia", apostadores: "apostador" };

export function formatRule(key: RuleKey, value: number): string {
  const unit = RULE_DEFS[key].unit;
  const n = value < 0 ? `−${-value}` : String(value);
  if (unit === "%") return `${n}%`;
  return `${n} ${Math.abs(value) === 1 ? (SINGULAR[unit] ?? unit) : unit}`;
}

export function slotBets(rules: Rules): number[] {
  return [...new Set([rules.slotBet1, rules.slotBet2, rules.slotBet3])].sort((a, b) => a - b);
}
