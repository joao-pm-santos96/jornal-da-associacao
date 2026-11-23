import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { getBalances } from "@/lib/economy";
import { memberStatement } from "@/lib/history";
import { Statement, StatementHeader } from "../../Statement";

export default async function MemberStatementPage({ params }: { params: Promise<{ id: string }> }) {
  await requireUser();
  const { id } = await params;
  if (!/^\d+$/.test(id)) notFound();
  const balances = await getBalances();
  const member = balances.find((b) => b.user_id === Number(id));
  if (!member) notFound();
  const lines = await memberStatement(member.user_id);

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <p className="text-sm">
        <Link href="/cofre" className="underline hover:text-scoop">← Cofre</Link>
      </p>
      <header className="flex flex-wrap items-end justify-between gap-4 border-b-4 border-ink pb-3">
        <div>
          <p className="text-xs font-black uppercase tracking-widest text-scoop">Extrato de conta</p>
          <h1 className="font-display text-4xl font-black">{member.name}</h1>
        </div>
        <p className={`font-display text-5xl font-black ${member.balance < 0 ? "text-scoop" : ""}`}>{member.balance} ☕</p>
      </header>
      <section>
        <StatementHeader />
        <Statement lines={lines} empty="Ainda não há movimentos." />
      </section>
    </div>
  );
}
