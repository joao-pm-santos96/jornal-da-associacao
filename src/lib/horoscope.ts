const SIGNS = [
  { name: "Bifana", emoji: "🥪" },
  { name: "Pastel de Nata", emoji: "🥧" },
  { name: "Francesinha", emoji: "🍳" },
  { name: "Tremoço", emoji: "🫘" },
  { name: "Imperial", emoji: "🍺" },
  { name: "Bacalhau", emoji: "🐟" },
  { name: "Caracol", emoji: "🐌" },
  { name: "Sardinha", emoji: "🐠" },
] as const;

const LOVE = [
  "Vénus entra na tua casa das tascas: um olhar cruzado ao balcão pode mudar tudo.",
  "O amor está no ar, mas também está no ar o cheiro a fritos. Cuidado com a confusão.",
  "Alguém pensa em ti. Infelizmente é {other}, e é por causa de uma dívida.",
  "Mercúrio retrógrado desaconselha mensagens depois da meia-noite. Tu sabes porquê.",
  "Este mês o teu coração bate mais forte. Provavelmente é o café. Bebe água.",
  "Uma paixão antiga regressa: aquele restaurante que fechou reabre com outro nome.",
  "Os astros sugerem um jantar romântico. {other} sugere um jantar de grupo. Ganha {other}.",
  "Sorriso fácil, coração aberto, carteira fechada.",
];

const NEWSROOM = [
  "O teu próximo post vai ter mais comentários do que leitores. Ninguém sabe explicar.",
  "Saturno aconselha a revisão ortográfica. {other} também, mas com menos educação.",
  "Um furo jornalístico espera por ti, algures entre o grupo do WhatsApp e a tua imaginação.",
  "Evita títulos em maiúsculas esta semana. Os astros estão cansados de gritos.",
  "{other} vai comentar o teu post só com um emoji. Aceita-o como elogio.",
  "A tua veia de cronista está no auge. A tua veia de leitor, nem por isso.",
  "Cuidado com a escala: o universo vê tudo, e o Mural da Vergonha também.",
  "Escreve sobre comida. Os astros, e a redação inteira, agradecem.",
];

const ADVICE = [
  "Nunca discutas futebol antes da sobremesa.",
  "Confia em {other}, mas confere a conta.",
  "Um café a meio da tarde resolve 80% dos problemas. Os outros 20% são do {other}.",
  "Lê os posts dos outros. É de borla e dá pontos no Quadro de Honra.",
  "Diz que sim ao próximo convite. Diz que não ao segundo digestivo.",
  "Se não sabes o que dizer, reage com 🧂.",
  "Hoje não é dia de pedir desculpa. Amanhã talvez.",
  "Quando em dúvida, culpa o {other}.",
];

const LUCKY = ["um tremoço", "a tampa de uma caneta Bic", "um bilhete do metro", "uma colher de pau", "um guardanapo de papel", "um isqueiro sem gás", "uma moeda de 2 cêntimos", "um porta-chaves da Nazaré"];
const COLORS = ["amarelo-gema", "verde-garrafa", "vermelho-tasca", "azul-azulejo", "castanho-bifana", "branco-toalha-de-papel"];

function hash(text: string): number {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function generator(seed: number): () => number {
  let state = seed;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export type Horoscope = {
  sign: (typeof SIGNS)[number];
  love: string;
  newsroom: string;
  advice: string;
  luckyNumber: number;
  luckyObject: string;
  color: string;
  match: string;
};

export function horoscopeFor(
  person: { id: number; name: string },
  others: string[],
  month: string,
): Horoscope {
  const random = generator(hash(`${person.id}:${month}`));
  const pick = <T,>(items: readonly T[]): T => items[Math.floor(random() * items.length)];
  const other = () => (others.length > 0 ? pick(others) : "o vizinho");
  const fill = (template: string) => {
    const name = other();
    return template.replaceAll("{other}", name);
  };
  return {
    sign: SIGNS[person.id % SIGNS.length],
    love: fill(pick(LOVE)),
    newsroom: fill(pick(NEWSROOM)),
    advice: fill(pick(ADVICE)),
    luckyNumber: 1 + Math.floor(random() * 99),
    luckyObject: pick(LUCKY),
    color: pick(COLORS),
    match: other(),
  };
}
