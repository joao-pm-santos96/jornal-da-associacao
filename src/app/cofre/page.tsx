import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { getBalances, listMovements, treasury, GRAOS } from "@/lib/economy";
import { getOffices } from "@/lib/offices";
import { formatDateTime } from "@/lib/dates";
import { MovementForm } from "./MovementForm";

function signed(n: number): string {
  return n > 0 ? `+${n}` : String(n);
}

export default async function TreasuryPage() {
  const user = await requireUser();
  const [balances, movements, offices] = await Promise.all([getBalances(), listMovements(), getOffices()]);
  const isTreasurer = offices.tesoureiro?.user_id === user.id;
  const cofre = treasury(balances);

  return (
    <div className="space-y-10">
      <header>
        <h1 className="font-display text-4xl font-black sm:text-5xl">Cofre da Associação</h1>
        <p className="text-muted">
          Contas certas, grãos contados. Tesoureiro: <strong>{offices.tesoureiro?.name ?? "vago"}</strong>.{" "}
          <Link href="/regras#cafe" className="underline hover:text-scoop">Como funciona?</Link>
        </p>
      </header>

      <section className="border-2 border-ink bg-flash p-6 text-center">
        <p className="text-xs font-black uppercase tracking-widest">Saldo do Cofre</p>
        <p className="font-display text-6xl font-black">{cofre} ☕</p>
        <p className="text-sm">cotas + multas − subsídios − prémios e bónus das festas</p>
      </section>

      <section>
        <h2 className="border-b-2 border-ink pb-1 font-display text-2xl font-black">Carteiras</h2>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[34rem] text-left text-sm">
            <thead className="text-xs uppercase tracking-wider text-muted">
              <tr>
                <th className="py-2 pr-2">Sócio</th>
                <th className="py-2 pr-2 text-right">Ganhos</th>
                <th className="py-2 pr-2 text-right">Cotas</th>
                <th className="py-2 pr-2 text-right">Faltas</th>
                <th className="py-2 pr-2 text-right">Bónus</th>
                <th className="py-2 pr-2 text-right">Livro</th>
                <th className="py-2 text-right">Saldo</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-rule">
              {balances.map((b) => (
                <tr key={b.user_id} className={b.user_id === user.id ? "bg-white font-semibold" : ""}>
                  <td className="py-2 pr-2">
                    {b.name}
                    {b.frozen && (
                      <span className="ml-2 bg-ink px-1.5 py-0.5 text-[10px] font-black uppercase text-white">
                        🧊 Congelado
                      </span>
                    )}
                  </td>
                  <td className="py-2 pr-2 text-right">{signed(b.earned)}</td>
                  <td className="py-2 pr-2 text-right">{signed(-b.fees)}</td>
                  <td className="py-2 pr-2 text-right">{b.fines ? signed(-b.fines) : "—"}</td>
                  <td className="py-2 pr-2 text-right">{b.bonuses ? signed(b.bonuses) : "—"}</td>
                  <td className="py-2 pr-2 text-right">{b.manual ? signed(b.manual) : "—"}</td>
                  <td className={`py-2 text-right font-display text-lg font-black ${b.balance < 0 ? "text-scoop" : ""}`}>
                    {b.balance} ☕
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-2 text-xs text-muted">
          Abaixo de {GRAOS.freezeBelow} ☕ a conta fica congelada: só se pode reagir com 🧂.
        </p>
      </section>

      {isTreasurer && (
        <section className="max-w-lg border-2 border-ink bg-white p-4">
          <h2 className="mb-3 font-display text-2xl font-black">💰 Gabinete do Tesoureiro</h2>
          <MovementForm members={balances.map((b) => ({ id: b.user_id, name: b.name }))} />
        </section>
      )}

      <section>
        <h2 className="border-b-2 border-ink pb-1 font-display text-2xl font-black">Livro do Cofre</h2>
        {movements.length === 0 ? (
          <p className="mt-2 text-muted">Ainda nenhum movimento. O Tesoureiro anda distraído.</p>
        ) : (
          <ul className="divide-y divide-rule">
            {movements.map((m) => (
              <li key={m.id} className="flex flex-wrap items-baseline justify-between gap-2 py-2 text-sm">
                <span>
                  <strong>{m.name}</strong> · {m.reason}
                  <span className="block text-xs text-muted">
                    {formatDateTime(m.created_at)} · {m.by ? `por ${m.by}` : "automático"}
                  </span>
                </span>
                <span className={`font-display text-lg font-black ${m.amount < 0 ? "text-scoop" : ""}`}>
                  {signed(m.amount)} ☕
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
