import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { getOffices } from "@/lib/offices";
import { listBets, STATUS_LABEL } from "@/lib/bets";
import { formatSchedule } from "@/lib/dates";
import { GRAOS } from "@/lib/economy";
import { NewBetForm } from "./BetForms";

export default async function BetsPage() {
  const user = await requireUser();
  const [bets, offices] = await Promise.all([listBets(), getOffices()]);
  const isManager = offices.apostas?.user_id === user.id;

  return (
    <div className="space-y-10">
      <header>
        <h1 className="font-display text-4xl font-black sm:text-5xl">🎲 Casa de Apostas</h1>
        <p className="text-muted">
          Gestor de Apostas: <strong>{offices.apostas?.name ?? "cargo vago"}</strong>. A casa fica com {GRAOS.betHouseCutPct}% de cada pote.{" "}
          <Link href="/regras#apostas" className="underline hover:text-scoop">Como funciona?</Link>
        </p>
      </header>

      {isManager && (
        <section className="max-w-2xl border-2 border-ink bg-white p-4">
          <h2 className="mb-3 font-display text-2xl font-black">🎲 Gabinete do Gestor</h2>
          <NewBetForm />
        </section>
      )}

      <section>
        {bets.length === 0 && <p className="text-muted">Ainda não há apostas. O Gestor está a afinar os dados.</p>}
        <ul className="divide-y divide-rule border-y-2 border-ink">
          {bets.map((b) => (
            <li key={b.id}>
              <Link href={`/apostas/${b.id}`} className="flex flex-wrap items-baseline justify-between gap-2 py-3 hover:text-scoop">
                <span>
                  <span className="text-xs font-black uppercase tracking-widest text-scoop">Aposta n.º {b.id}</span>
                  <span className="block font-display text-xl font-bold leading-tight">{b.title}</span>
                </span>
                <span className="text-right text-sm">
                  <span className="block font-bold">{b.pot} ☕ no pote · {b.bettors} {b.bettors === 1 ? "apostador" : "apostadores"}</span>
                  <span className="block text-muted">
                    {b.status === "open" && `Fecha ${formatSchedule(b.closes_at)}`}
                    {b.status === "closed" && STATUS_LABEL.closed}
                    {b.status === "resolved" && `Saiu «${b.winner}»`}
                    {b.status === "void" && STATUS_LABEL.void}
                  </span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
