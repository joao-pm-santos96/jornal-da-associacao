import "server-only";
import { cache } from "react";
import { sql } from "./db";
import { GRAOS } from "./graos";
import { SLOT_SYMBOLS, totalWeight, type SlotPay } from "./slot-table";
import { SCRATCH_ODDS_BASE, SCRATCH_SYMBOLS, type ScratchPrize } from "./scratch-table";

export type RuleUnit = "☕" | "%" | "×" | "peso" | "em 3000" | "pontos" | "h" | "dias" | "vezes" | "apostadores";

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
  slotTremocoPeso: { group: "Slot machine", label: "🫘 Tremoço: peso em cada rolo", unit: "peso", min: 0, max: 1_000 },
  slotTremoco3: { group: "Slot machine", label: "🫘 Tremoço: três iguais", unit: "×", min: 0, max: 10_000 },
  slotTremoco2: { group: "Slot machine", label: "🫘 Tremoço: dois iguais", unit: "×", min: 0, max: 10_000 },
  slotImperialPeso: { group: "Slot machine", label: "🍺 Imperial: peso em cada rolo", unit: "peso", min: 0, max: 1_000 },
  slotImperial3: { group: "Slot machine", label: "🍺 Imperial: três iguais", unit: "×", min: 0, max: 10_000 },
  slotImperial2: { group: "Slot machine", label: "🍺 Imperial: dois iguais", unit: "×", min: 0, max: 10_000 },
  slotPatoPeso: { group: "Slot machine", label: "🦆 Pato: peso em cada rolo", unit: "peso", min: 0, max: 1_000 },
  slotPato3: { group: "Slot machine", label: "🦆 Pato: três iguais", unit: "×", min: 0, max: 10_000 },
  slotPato2: { group: "Slot machine", label: "🦆 Pato: dois iguais", unit: "×", min: 0, max: 10_000 },
  slotCaoPeso: { group: "Slot machine", label: "🐕 Cão: peso em cada rolo", unit: "peso", min: 0, max: 1_000 },
  slotCao3: { group: "Slot machine", label: "🐕 Cão: três iguais", unit: "×", min: 0, max: 10_000 },
  slotCao2: { group: "Slot machine", label: "🐕 Cão: dois iguais", unit: "×", min: 0, max: 10_000 },
  slotBacalhauPeso: { group: "Slot machine", label: "🐟 Bacalhau: peso em cada rolo", unit: "peso", min: 0, max: 1_000 },
  slotBacalhau3: { group: "Slot machine", label: "🐟 Bacalhau: três iguais", unit: "×", min: 0, max: 10_000 },
  slotBacalhau2: { group: "Slot machine", label: "🐟 Bacalhau: dois iguais", unit: "×", min: 0, max: 10_000 },
  slotNataPeso: { group: "Slot machine", label: "🥧 Pastel de nata: peso em cada rolo", unit: "peso", min: 0, max: 1_000 },
  slotNata3: { group: "Slot machine", label: "🥧 Pastel de nata: três iguais", unit: "×", min: 0, max: 10_000 },
  slotNata2: { group: "Slot machine", label: "🥧 Pastel de nata: dois iguais", unit: "×", min: 0, max: 10_000 },
  slotCoroaPeso: { group: "Slot machine", label: "👑 Coroa: peso em cada rolo", unit: "peso", min: 0, max: 1_000 },
  slotCoroa3: { group: "Slot machine", label: "👑 Coroa: três iguais", unit: "×", min: 0, max: 10_000 },
  slotCoroa2: { group: "Slot machine", label: "👑 Coroa: dois iguais", unit: "×", min: 0, max: 10_000 },
  slotCafePeso: { group: "Slot machine", label: "☕ Café: peso em cada rolo", unit: "peso", min: 0, max: 1_000 },
  slotCafe3: { group: "Slot machine", label: "☕ Café: três iguais", unit: "×", min: 0, max: 10_000 },
  slotCafe2: { group: "Slot machine", label: "☕ Café: dois iguais", unit: "×", min: 0, max: 10_000 },
  scratchCost: { group: "Raspadinha", label: "Preço do bilhete (os prémios são múltiplos)", unit: "☕", min: 1, max: MAX },
  scratchCafeX: { group: "Raspadinha", label: "☕☕☕ Café: prémio", unit: "×", min: 0, max: 10_000 },
  scratchCafeEm: { group: "Raspadinha", label: "☕☕☕ Café: bilhetes premiados", unit: "em 3000", min: 0, max: 3_000 },
  scratchCoroaX: { group: "Raspadinha", label: "👑👑👑 Coroa: prémio", unit: "×", min: 0, max: 10_000 },
  scratchCoroaEm: { group: "Raspadinha", label: "👑👑👑 Coroa: bilhetes premiados", unit: "em 3000", min: 0, max: 3_000 },
  scratchNataX: { group: "Raspadinha", label: "🥧🥧🥧 Pastel de nata: prémio", unit: "×", min: 0, max: 10_000 },
  scratchNataEm: { group: "Raspadinha", label: "🥧🥧🥧 Pastel de nata: bilhetes premiados", unit: "em 3000", min: 0, max: 3_000 },
  scratchPatoX: { group: "Raspadinha", label: "🦆🦆🦆 Pato: prémio", unit: "×", min: 0, max: 10_000 },
  scratchPatoEm: { group: "Raspadinha", label: "🦆🦆🦆 Pato: bilhetes premiados", unit: "em 3000", min: 0, max: 3_000 },
  scratchTremocoX: { group: "Raspadinha", label: "🫘🫘🫘 Tremoço: prémio", unit: "×", min: 0, max: 10_000 },
  scratchTremocoEm: { group: "Raspadinha", label: "🫘🫘🫘 Tremoço: bilhetes premiados", unit: "em 3000", min: 0, max: 3_000 },
  raceHouseCutPct: { group: "Casino", label: "Corrida de patos: parte da casa", unit: "%", min: 0, max: 100 },
  duelHouseCutPct: { group: "Casino", label: "Duelos: parte da casa", unit: "%", min: 0, max: 100 },
  duelMinStake: { group: "Casino", label: "Duelos: aposta mínima", unit: "☕", min: 1, max: MAX },
  duelExpiryHours: { group: "Casino", label: "Duelos: prazo para responder", unit: "h", min: 1, max: 720 },
  poolHouseCutPct: { group: "Casino", label: "Bilhar: parte da casa", unit: "%", min: 0, max: 100 },
  poolMinStake: { group: "Casino", label: "Bilhar: aposta mínima (0 = partidas amigáveis)", unit: "☕", min: 0, max: MAX },
  poolAcceptHours: { group: "Casino", label: "Bilhar: prazo para aceitar um desafio", unit: "h", min: 1, max: 720 },
  poolTurnHours: { group: "Casino", label: "Bilhar: prazo para cada jogada", unit: "h", min: 1, max: 720 },
  reflexHouseCutPct: { group: "Casino", label: "Gatilho: parte da casa", unit: "%", min: 0, max: 100 },
  reflexMinStake: { group: "Casino", label: "Gatilho: aposta mínima (0 = partidas amigáveis)", unit: "☕", min: 0, max: MAX },
  reflexAcceptHours: { group: "Casino", label: "Gatilho: prazo para aceitar um desafio", unit: "h", min: 1, max: 720 },
  reflexTurnHours: { group: "Casino", label: "Gatilho: prazo para jogar a sua vez", unit: "h", min: 1, max: 720 },
  comedyPrize: { group: "Comedy Club", label: "Prémio do palhaço da semana (pago pelo Cofre)", unit: "☕", min: 0, max: MAX },
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
  if (unit === "×") return `×${n}`;
  if (unit === "peso") return `peso ${n}`;
  if (unit === "em 3000") return `${n} em 3000`;
  return `${n} ${Math.abs(value) === 1 ? (SINGULAR[unit] ?? unit) : unit}`;
}

const SLOT_KEYS = {
  "🫘": ["slotTremocoPeso", "slotTremoco3", "slotTremoco2"],
  "🍺": ["slotImperialPeso", "slotImperial3", "slotImperial2"],
  "🦆": ["slotPatoPeso", "slotPato3", "slotPato2"],
  "🐕": ["slotCaoPeso", "slotCao3", "slotCao2"],
  "🐟": ["slotBacalhauPeso", "slotBacalhau3", "slotBacalhau2"],
  "🥧": ["slotNataPeso", "slotNata3", "slotNata2"],
  "👑": ["slotCoroaPeso", "slotCoroa3", "slotCoroa2"],
  "☕": ["slotCafePeso", "slotCafe3", "slotCafe2"],
} as const satisfies Record<string, readonly [RuleKey, RuleKey, RuleKey]>;

export function slotPaytable(rules: Rules): SlotPay[] {
  return SLOT_SYMBOLS.map((s) => {
    const keys = SLOT_KEYS[s.emoji as keyof typeof SLOT_KEYS];
    return { ...s, weight: rules[keys[0]], triple: rules[keys[1]], pair: rules[keys[2]] };
  });
}

const SCRATCH_KEYS = {
  "☕": ["scratchCafeX", "scratchCafeEm"],
  "👑": ["scratchCoroaX", "scratchCoroaEm"],
  "🥧": ["scratchNataX", "scratchNataEm"],
  "🦆": ["scratchPatoX", "scratchPatoEm"],
  "🫘": ["scratchTremocoX", "scratchTremocoEm"],
} as const satisfies Record<string, readonly [RuleKey, RuleKey]>;

export function scratchPrizes(rules: Rules): ScratchPrize[] {
  return SCRATCH_SYMBOLS.map((s) => {
    const keys = SCRATCH_KEYS[s.emoji as keyof typeof SCRATCH_KEYS];
    return { ...s, multiplier: rules[keys[0]], chances: rules[keys[1]] };
  });
}

export function rulesProblem(rules: Rules): string | null {
  if (totalWeight(slotPaytable(rules)) < 1) return "A slot precisa de pelo menos um símbolo com peso acima de 0.";
  const chances = scratchPrizes(rules).reduce((sum, p) => sum + p.chances, 0);
  if (chances > SCRATCH_ODDS_BASE) return `Os bilhetes premiados da raspadinha somam ${chances} em ${SCRATCH_ODDS_BASE}: não podem passar de ${SCRATCH_ODDS_BASE}.`;
  return null;
}

export function slotBets(rules: Rules): number[] {
  return [...new Set([rules.slotBet1, rules.slotBet2, rules.slotBet3])].sort((a, b) => a - b);
}
