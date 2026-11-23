import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { getOffices } from "@/lib/offices";
import { getBet, netPot, STATUS_LABEL } from "@/lib/bets";
import { getBalances, GRAOS } from "@/lib/economy";
import { formatDateTime, formatSchedule } from "@/lib/dates";
import { ConfirmButton } from "@/components/ConfirmButton";
import { closeBetNow, voidBet } from "../actions";
import { ResolveForm, WagerForm } from "../BetForms";

const odds = new Intl.NumberFormat("pt-PT", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export default async function BetPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const { id } = await params;
  if (!/^\d+$/.test(id)) notFound();
  const [bet, offices, balances] = await Promise.all([getBet(Number(id), user.id), getOffices(), getBalances()]);
  if (!bet) notFound();
  const isManager = offices.apostas?.user_id === user.id;
  const balance = balances.find((b) => b.user_id === user.id)?.balance ?? 0;
  const myTotal = bet.mine.reduce((sum, w) => sum + w.amount, 0);
  const labelOf = (optionId: number) => bet.options.find((o) => o.id === optionId)?.label ?? "?";

  return (
    <div className="mx-auto max-w-2xl space-y-8">
      <p className="text-sm">
        <Link href="/apostas" className="underline hover:text-scoop">← Casa de Apostas</Link>
      </p>
      <header className="border-4 border-double border-ink bg-white p-4">
        <p className="text-xs font-black uppercase tracking-widest text-scoop">
          🎲 Aposta n.º {bet.id} · {STATUS_LABEL[bet.status]}
        </p>
        <h1 className="mt-1 font-display text-3xl font-black leading-tight sm:text-4xl">{bet.title}</h1>
        {bet.description && <p className="mt-2 whitespace-pre-wrap">{bet.description}</p>}
        <p className="mt-3 text-sm text-muted">
          {bet.status === "open" ? `Fecha ${formatSchedule(bet.closes_at)}` : `Fechou a ${formatDateTime(bet.closes_at)}`}
          {bet.author && ` · aberta por ${bet.author}`}
        </p>
      </header>

      <section className="grid grid-cols-2 gap-3">
        <div className="border-2 border-ink bg-flash p-3 text-center">
          <p className="font-display text-4xl font-black">{bet.pot} ☕</p>
          <p className="text-xs font-bold uppercase tracking-widest">no pote</p>
        </div>
        <div className="border-2 border-ink bg-white p-3 text-center">
          <p className="font-display text-4xl font-black">{netPot(bet.pot)} ☕</p>
          <p className="text-xs font-bold uppercase tracking-widest text-muted">para os vencedores</p>
        </div>
      </section>

      <section>
        <h2 className="border-b-2 border-ink pb-1 font-display text-2xl font-black">Opções</h2>
        <ul className="divide-y divide-rule">
          {bet.options.map((o) => {
            const won = bet.winning_option === o.id;
            return (
              <li key={o.id} className={`flex items-baseline justify-between gap-3 py-2 ${won ? "bg-flash px-2" : ""}`}>
                <span className="font-display text-xl font-bold">
                  {won && "🏆 "}
                  {o.label}
                </span>
                <span className="text-right text-sm">
                  <span className="block font-bold">{o.total} ☕ · {o.bettors} {o.bettors === 1 ? "apostador" : "apostadores"}</span>
                  {bet.status === "open" && (
                    <span className="block text-muted">
                      {o.payout === null ? "ainda ninguém apostou aqui" : `1 ☕ paga ${odds.format(o.payout)} ☕`}
                    </span>
                  )}
                </span>
              </li>
            );
          })}
        </ul>
      </section>

      {bet.mine.length > 0 && (
        <section className="border-2 border-ink bg-white p-3 text-sm">
          <p className="font-bold">As tuas apostas ({myTotal} ☕)</p>
          <ul className="mt-1 list-disc pl-6">
            {bet.mine.map((w, i) => <li key={i}>{w.amount} ☕ em «{labelOf(w.option_id)}»</li>)}
          </ul>
        </section>
      )}

      {bet.status === "open" && (
        <section className="space-y-2">
          <h2 className="border-b-2 border-ink pb-1 font-display text-2xl font-black">Apostar</h2>
          <WagerForm betId={bet.id} options={bet.options} balance={balance} />
          <p className="text-xs text-muted">
            Os grãos saem logo do teu saldo. As apostas de cada um só se revelam quando a aposta fechar.
          </p>
        </section>
      )}

      {bet.status !== "open" && (
        <section>
          <h2 className="border-b-2 border-ink pb-1 font-display text-2xl font-black">Quem apostou em quê</h2>
          {bet.wagers.length === 0 ? (
            <p className="mt-2 text-muted">Ninguém apostou. O Gestor ficou a falar sozinho.</p>
          ) : (
            <ul className="divide-y divide-rule text-sm">
              {bet.wagers.map((w, i) => (
                <li key={i} className="flex justify-between py-1.5">
                  <span>{w.name}</span>
                  <span className={bet.winning_option === w.option_id ? "font-bold" : ""}>
                    {w.amount} ☕ em «{labelOf(w.option_id)}»
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      {isManager && (bet.status === "open" || bet.status === "closed") && (
        <section className="space-y-4 border-2 border-ink bg-white p-4">
          <h2 className="font-display text-2xl font-black">🎲 Gabinete do Gestor</h2>
          {bet.status === "closed" ? (
            <ResolveForm betId={bet.id} options={bet.options} />
          ) : (
            <p className="text-sm text-muted">O resultado declara-se depois de a aposta fechar.</p>
          )}
          <div className="flex flex-wrap gap-4 text-sm">
            {bet.status === "open" && (
              <form action={closeBetNow.bind(null, bet.id)}>
                <ConfirmButton message="Fechar já as apostas?" className="underline">Fechar apostas agora</ConfirmButton>
              </form>
            )}
            <form action={voidBet.bind(null, bet.id)}>
              <ConfirmButton message="Anular a aposta e devolver os grãos a toda a gente?" className="text-scoop underline">
                Anular e devolver tudo
              </ConfirmButton>
            </form>
          </div>
          <p className="text-xs text-muted">
            Com {GRAOS.betManagerMinBettors} ou mais apostadores, o Gestor recebe {GRAOS.betManagerFee} ☕ de comissão ao declarar o resultado.
          </p>
        </section>
      )}
    </div>
  );
}
