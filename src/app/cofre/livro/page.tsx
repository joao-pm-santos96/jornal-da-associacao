import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { treasuryStatement } from "@/lib/history";
import { Statement, StatementHeader } from "../Statement";
import { AuditButton } from "../RepresentationForms";
import { GRAOS, getEconomy, weekOf } from "@/lib/economy";
import { getNow } from "@/lib/seasons";
import { REPRESENTATION, auditedThisWeek, representationTotal } from "@/lib/slush";

export default async function TreasuryBookPage() {
  const user = await requireUser();
  const week = weekOf(await getNow());
  const [economy, lines, representation, audited] = await Promise.all([
    getEconomy(),
    treasuryStatement(),
    representationTotal(),
    auditedThisWeek(user.id, week),
  ]);

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <p className="text-sm">
        <Link href="/cofre" className="underline hover:text-scoop">← Cofre</Link>
      </p>
      <header className="flex flex-wrap items-end justify-between gap-4 border-b-4 border-ink pb-3">
        <div>
          <p className="text-xs font-black uppercase tracking-widest text-scoop">Contabilidade organizada</p>
          <h1 className="font-display text-4xl font-black">Livro do Cofre</h1>
          <p className="text-sm text-muted">
            Tudo o que entrou e saiu do Cofre, do mais recente para o mais antigo. O saldo inclui os grãos em jogo; as dívidas só
            contam quando são pagas.
          </p>
        </div>
        <p className="font-display text-5xl font-black">{economy.cofre} ☕</p>
      </header>
      {representation > 0 && (
        <section className="space-y-2 border-2 border-ink bg-flash p-4">
          <p className="text-sm">
            <strong>{representation} ☕</strong> em {REPRESENTATION.toLowerCase()} nas últimas {GRAOS.auditWindowDays / 7} semanas, sem fatura à vista.
            Desconfias? Uma auditoria investiga as contas do governo e, se apanhar alguém, dá-te {GRAOS.auditRewardPct}% do que recuperar.
          </p>
          <AuditButton cost={GRAOS.auditCost} done={audited} />
        </section>
      )}
      <section>
        <StatementHeader />
        <Statement lines={lines} empty="O Cofre ainda não mexeu." />
      </section>
    </div>
  );
}
