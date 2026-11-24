import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { getEconomy } from "@/lib/economy";
import { treasuryStatement } from "@/lib/history";
import { Statement, StatementHeader } from "../Statement";

export default async function TreasuryBookPage() {
  await requireUser();
  const [economy, lines] = await Promise.all([getEconomy(), treasuryStatement()]);

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
      <section>
        <StatementHeader />
        <Statement lines={lines} empty="O Cofre ainda não mexeu." />
      </section>
    </div>
  );
}
