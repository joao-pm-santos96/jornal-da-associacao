import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { getOffices } from "@/lib/offices";
import { RULE_DEFS, RULE_KEYS, formatRule, getRules, scratchPrizes, slotPaytable } from "@/lib/rules";
import { expectedReturn } from "@/lib/slot-table";
import { SCRATCH_ODDS_BASE, scratchReturn, scratchWinChance } from "@/lib/scratch-table";
import { RulesForm, type RuleGroup } from "./RulesForm";

export default async function RulesTablePage() {
  const user = await requireUser();
  const [rules, offices] = await Promise.all([getRules(), getOffices()]);
  const isTreasurer = offices.tesoureiro?.user_id === user.id;
  const groups: RuleGroup[] = [];
  for (const key of RULE_KEYS) {
    const def = RULE_DEFS[key];
    let group = groups.find((g) => g.group === def.group);
    if (!group) groups.push((group = { group: def.group, items: [] }));
    group.items.push({ key, label: def.label, unit: def.unit, value: rules[key], min: def.min, max: def.max });
  }
  const pct = (x: number) => String(Math.round(x * 1000) / 10).replace(".", ",");
  const rtp = Math.round(expectedReturn(slotPaytable(rules)) * 1000) / 10;
  const slot = groups.find((g) => g.group === "Slot machine");
  if (slot) {
    slot.note = `Prémio = aposta × multiplicador. Em cada rolo, a probabilidade de um símbolo é o seu peso a dividir pela soma dos pesos. Com os valores em vigor, a máquina devolve em média ${pct(rtp / 100)}% do que recebe${rtp > 100 ? ": acima de 100%, quem perde é o Cofre." : "; o resto fica no Cofre."}`;
  }
  const prizes = scratchPrizes(rules);
  const scratchRtp = scratchReturn(prizes);
  const scratch = groups.find((g) => g.group === "Raspadinha");
  if (scratch) {
    scratch.note = `Prémio = preço do bilhete × multiplicador. Os bilhetes premiados são contados em cada ${SCRATCH_ODDS_BASE} e, somados, não podem passar de ${SCRATCH_ODDS_BASE}. Com os valores em vigor, sai prémio em ${pct(scratchWinChance(prizes))}% dos bilhetes e a raspadinha devolve em média ${pct(scratchRtp)}% do que custa${scratchRtp > 1 ? ": acima de 100%, quem perde é o Cofre." : "; o resto fica no Cofre."}`;
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <p className="text-sm">
        <Link href="/cofre" className="underline hover:text-scoop">← Cofre</Link>
      </p>
      <header className="border-b-4 border-ink pb-3">
        <p className="text-xs font-black uppercase tracking-widest text-scoop">Em vigor</p>
        <h1 className="font-display text-4xl font-black">Tabela de preços e taxas</h1>
        <p className="text-sm text-muted">
          Quem manda nos números é o Tesoureiro ({offices.tesoureiro?.name ?? "cargo vago"}). Cada mudança sai num despacho em{" "}
          <Link href="/decretos" className="underline hover:text-scoop">/decretos</Link> e conta logo a partir desse momento.
        </p>
      </header>

      {isTreasurer ? (
        <RulesForm groups={groups} />
      ) : (
        groups.map((g) => (
          <section key={g.group}>
            <h2 className="border-b-2 border-ink pb-1 font-display text-2xl font-black">{g.group}</h2>
            {g.note && <p className="mt-1 text-sm text-muted">{g.note}</p>}
            <ul className="divide-y divide-rule">
              {g.items.map((r) => (
                <li key={r.key} className="flex justify-between gap-3 py-2 text-sm">
                  <span>{r.label}</span>
                  <strong className="shrink-0">{formatRule(r.key as keyof typeof RULE_DEFS, r.value)}</strong>
                </li>
              ))}
            </ul>
          </section>
        ))
      )}
    </div>
  );
}
