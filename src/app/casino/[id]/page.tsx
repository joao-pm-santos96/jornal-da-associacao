import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { getBet, netPot, STATUS_LABEL } from "@/lib/bets";
import { getBalances } from "@/lib/economy";
import { getRules } from "@/lib/rules";
import { formatDateTime, formatSchedule } from "@/lib/dates";
import { ConfirmButton } from "@/components/ConfirmButton";
import { closeBetNow, voidBet } from "../actions";
import { ResolveForm, WagerForm } from "../BetForms";
import { Chip, Disclaimer, Marquee, Sticker, felt, gold } from "../Decor";

const odds = new Intl.NumberFormat("pt-PT", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export default async function BetPage({ params }: { params: Promise<{ id: string }> }) {
  const R = await getRules();
  const user = await requireUser();
  const { id } = await params;
  if (!/^\d+$/.test(id)) notFound();
  const [bet, balances] = await Promise.all([getBet(Number(id), user.id), getBalances()]);
  if (!bet) notFound();
  const isBanker = bet.created_by === user.id;
  const canManage = isBanker || user.is_admin;
  const balance = balances.find((b) => b.user_id === user.id)?.balance ?? 0;
  const myTotal = bet.mine.reduce((sum, w) => sum + w.amount, 0);
  const labelOf = (optionId: number) => bet.options.find((o) => o.id === optionId)?.label ?? "?";

  return (
    <div className={`-mx-4 -my-6 space-y-8 px-4 py-6 sm:mx-0 sm:border-4 sm:border-[#141414] ${felt}`}>
      <Marquee small />

      <div className="mx-auto max-w-2xl space-y-8">
        <p className="text-sm">
          <Link href="/casino" className="underline">← Voltar às mesas</Link>
        </p>

        <header className="relative border-2 border-dashed border-[#141414] bg-[#fff6d6] p-4 text-[#141414] outline outline-4 outline-[#fff6d6]">
          <Sticker className="absolute -right-2 -top-3">{STATUS_LABEL[bet.status]}</Sticker>
          <p className="text-xs font-black uppercase tracking-widest text-[#e10600]">🎰 Mesa n.º {bet.id}</p>
          <h1 className="mt-1 font-display text-3xl font-black leading-tight sm:text-4xl">{bet.title}</h1>
          {bet.description && <p className="mt-2 whitespace-pre-wrap">{bet.description}</p>}
          <p className="mt-3 text-sm text-muted">
            {bet.status === "open" ? `Fecha ${formatSchedule(bet.closes_at)}` : `Fechou a ${formatDateTime(bet.closes_at)}`}
            {bet.author && ` · banca: ${bet.author}`}
          </p>
        </header>

        <section className="flex justify-center gap-8">
          <Chip value={`${bet.pot}`} label="☕ no pote" />
          <Chip value={`${netPot(bet.pot, R.betHouseCutPct)}`} label="☕ para quem acertar" tone="black" />
        </section>

        <section>
          <h2 className={`border-b-2 border-[#fff6d6] pb-1 font-display text-2xl font-black uppercase ${gold}`}>O pano</h2>
          <ul className="mt-2 grid gap-2">
            {bet.options.map((o) => {
              const won = bet.winning_option === o.id;
              return (
                <li
                  key={o.id}
                  className={`flex items-center justify-between gap-3 border-2 p-3 ${
                    won ? "border-[#f2c230] bg-[#f2c230] text-[#141414]" : "border-[#fff6d6]/60 bg-[#08502b]"
                  }`}
                >
                  <span className="font-display text-xl font-black">
                    {won && "🏆 "}
                    {o.label}
                  </span>
                  <span className="text-right text-sm">
                    <span className="block font-bold">{o.total} ☕ · {o.bettors} {o.bettors === 1 ? "apostador" : "apostadores"}</span>
                    {bet.status === "open" && (
                      <span className={`block ${gold}`}>
                        {o.payout === null ? "ainda ninguém arriscou" : `paga ${odds.format(o.payout)} por 1`}
                      </span>
                    )}
                  </span>
                </li>
              );
            })}
          </ul>
        </section>

        {bet.mine.length > 0 && (
          <section className="border-2 border-dashed border-[#f2c230] p-3 text-sm">
            <p className="font-bold">As tuas fichas na mesa ({myTotal} ☕)</p>
            <ul className="mt-1 list-disc pl-6">
              {bet.mine.map((w, i) => <li key={i}>{w.amount} ☕ em «{labelOf(w.option_id)}»</li>)}
            </ul>
          </section>
        )}

        {bet.status === "open" && (
          <section className="space-y-2 border-4 border-double border-[#f2c230] bg-[#08502b] p-4">
            <h2 className={`font-display text-2xl font-black uppercase ${gold}`}>Façam as vossas apostas</h2>
            {isBanker ? (
              <p className="text-sm">A mesa é tua: a banca não aposta na própria aposta.</p>
            ) : (
              <WagerForm betId={bet.id} options={bet.options} balance={balance} />
            )}
            <p className="text-xs opacity-80">
              Os grãos saem logo do teu saldo. As apostas de cada um só se revelam quando a mesa fechar.
            </p>
          </section>
        )}

        {bet.status !== "open" && (
          <section>
            <h2 className={`border-b-2 border-[#fff6d6] pb-1 font-display text-2xl font-black uppercase ${gold}`}>
              Quem apostou em quê
            </h2>
            {bet.wagers.length === 0 ? (
              <p className="mt-2 italic opacity-80">Ninguém apostou. A banca ficou a falar sozinha.</p>
            ) : (
              <ul className="divide-y divide-[#fff6d6]/30 text-sm">
                {bet.wagers.map((w, i) => (
                  <li key={i} className="flex justify-between py-1.5">
                    <span>{w.name}</span>
                    <span className={bet.winning_option === w.option_id ? `font-bold ${gold}` : ""}>
                      {w.amount} ☕ em «{labelOf(w.option_id)}»
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </section>
        )}

        {canManage && (bet.status === "open" || bet.status === "closed") && (
          <section className="space-y-4 border-2 border-[#141414] bg-[#fff6d6] p-4 text-[#141414]">
            <h2 className="font-display text-2xl font-black">🎩 Balcão da banca</h2>
            {!isBanker && <p className="text-sm font-bold text-scoop">Estás aqui como admin, não como banca.</p>}
            {bet.status === "closed" ? (
              <ResolveForm betId={bet.id} options={bet.options} />
            ) : (
              <p className="text-sm text-muted">O resultado declara-se depois de a mesa fechar.</p>
            )}
            <div className="flex flex-wrap gap-4 text-sm">
              {bet.status === "open" && (
                <form action={closeBetNow.bind(null, bet.id)}>
                  <ConfirmButton message="Fechar já as apostas?" className="underline">Fechar apostas agora</ConfirmButton>
                </form>
              )}
              <form action={voidBet.bind(null, bet.id)}>
                <ConfirmButton message="Anular a aposta e devolver os grãos apostados? A licença não é devolvida." className="text-scoop underline">
                  Anular e devolver as apostas
                </ConfirmButton>
              </form>
            </div>
            <p className="text-xs text-muted">
              Com {R.betBankerMinBettors} ou mais apostadores, a banca recebe até {R.betBankerFee} ☕ de comissão ao declarar o resultado, tirados da parte da casa.
            </p>
          </section>
        )}

        <Disclaimer />
      </div>
    </div>
  );
}
