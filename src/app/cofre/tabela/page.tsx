import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { getOffices } from "@/lib/offices";
import { RULE_DEFS, RULE_KEYS, formatRule, getRules } from "@/lib/rules";
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
