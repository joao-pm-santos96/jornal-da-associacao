import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { getBalances } from "@/lib/economy";
import { duelsFor } from "@/lib/duels";
import { duelPrize, moveEmoji } from "@/lib/duels-table";
import { getRules } from "@/lib/rules";
import { timeAgo } from "@/lib/dates";
import { ConfirmButton } from "@/components/ConfirmButton";
import { Disclaimer, Marquee, felt, gold } from "../Decor";
import { cancelDuel, declineDuel } from "./actions";
import { ChallengeForm, DuelResultSound, RespondForm } from "./DuelForms";

const VERBS = ["esmagou", "humilhou", "despachou", "deu uma lição a", "mandou para casa"];

export default async function DuelsPage({ searchParams }: { searchParams: Promise<{ duelo?: string }> }) {
  const user = await requireUser();
  const R = await getRules();
  const { duelo } = await searchParams;
  const [balances, duels] = await Promise.all([getBalances(), duelsFor(user.id)]);
  const balance = balances.find((b) => b.user_id === user.id)?.balance ?? 0;
  const members = balances.filter((b) => b.user_id !== user.id).map((b) => ({ id: b.user_id, name: b.name }));
  const card = "border-2 border-dashed border-[#141414] bg-[#fff6d6] p-4 text-[#141414] outline outline-4 outline-[#fff6d6]";
  const just = duels.arena.find((d) => String(d.id) === duelo && (d.challenger_id === user.id || d.opponent_id === user.id));
  const justWon = just?.winner_id === user.id;
  const justTie = just?.winner_id === null;
  const rival = just ? (just.challenger_id === user.id ? just.opponent : just.challenger) : "";

  return (
    <div className={`-mx-4 -my-6 space-y-8 px-4 py-6 sm:mx-0 sm:border-4 sm:border-[#141414] ${felt}`}>
      <Marquee small />
      <p className="text-sm">
        <Link href="/casino" className="underline">← Voltar às mesas</Link>
      </p>

      <header className="text-center">
        <h1 className={`font-display text-4xl font-black uppercase ${gold}`}>⚔️ Duelos</h1>
        <p className="text-sm">
          Pedra, papel ou tesoura a dinheiro. Quem ganha leva o pote menos {R.duelHouseCutPct}%. Empate: cada um fica com o seu.
        </p>
      </header>

      {just && <DuelResultSound duelId={just.id} result={justWon ? "win" : justTie ? "tie" : "loss"} />}
      {just && (
        <section
          className={`mx-auto max-w-xl border-4 border-[#141414] p-4 text-center shadow-[6px_6px_0_#141414] ${
            justWon ? "animate-bounce bg-[#f2c230] text-[#141414]" : justTie ? "bg-white text-[#141414]" : "bg-[#141414] text-[#fff6d6]"
          }`}
        >
          <p className="text-5xl">
            {moveEmoji(just.challenger_move)} <span className="text-2xl">vs</span> {moveEmoji(just.opponent_move)}
          </p>
          <p className="mt-2 font-display text-2xl font-black">
            {justTie ? `Empate com ${rival}!` : justWon ? `Ganhaste ${duelPrize(just.stake, R.duelHouseCutPct)} ☕ a ${rival}!` : `${rival} ganhou-te ${just.stake} ☕.`}
          </p>
          <p className="text-sm">{justTie ? "Cada um fica com os seus grãos." : justWon ? "Humilhação registada na Arena." : "Fica para a desforra."}</p>
        </section>
      )}

      {duels.incoming.length > 0 && (
        <section className="mx-auto max-w-xl space-y-3">
          <h2 className={`font-display text-2xl font-black uppercase ${gold}`}>Foste desafiado!</h2>
          {duels.incoming.map((d) => (
            <div key={d.id} className={`${card} space-y-3`}>
              <p>
                <strong>{d.challenger}</strong> desafiou-te para um duelo de <strong>{d.stake} ☕</strong>. Se ganhares, levas{" "}
                <strong>{duelPrize(d.stake, R.duelHouseCutPct)} ☕</strong>.
                <span className="block text-xs text-muted">Desafio feito {timeAgo(d.created_at)} · expira {R.duelExpiryHours}h depois</span>
              </p>
              <RespondForm duelId={d.id} />
              <form action={declineDuel.bind(null, d.id)}>
                <ConfirmButton message="Recusar o duelo? Os grãos voltam para quem te desafiou." className="text-sm text-scoop underline">
                  Recusar (🐔)
                </ConfirmButton>
              </form>
            </div>
          ))}
        </section>
      )}

      <section className={`mx-auto max-w-xl ${card}`}>
        <h2 className="mb-3 font-display text-2xl font-black">Desafiar alguém</h2>
        <ChallengeForm members={members} balance={balance} min={R.duelMinStake} />
        <p className="mt-2 text-xs text-muted">
          Os grãos saem logo do teu saldo. Se o adversário recusar ou não responder em {R.duelExpiryHours}h, voltam para ti.
        </p>
      </section>

      {duels.outgoing.length > 0 && (
        <section className="mx-auto max-w-xl">
          <h2 className={`border-b-2 border-dashed border-[#f2c230] pb-1 font-display text-xl font-black uppercase ${gold}`}>À espera de resposta</h2>
          <ul className="divide-y divide-[#fff6d6]/20 text-sm">
            {duels.outgoing.map((d) => (
              <li key={d.id} className="flex items-center justify-between gap-2 py-2">
                <span>
                  {d.opponent} · {d.stake} ☕ · a tua jogada: {moveEmoji(d.challenger_move)}
                </span>
                <form action={cancelDuel.bind(null, d.id)}>
                  <ConfirmButton message="Cancelar o desafio?" className="underline">Cancelar</ConfirmButton>
                </form>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="mx-auto max-w-xl">
        <h2 className={`border-b-2 border-dashed border-[#f2c230] pb-1 font-display text-xl font-black uppercase ${gold}`}>A Arena</h2>
        {duels.arena.length === 0 ? (
          <p className="mt-2 text-sm italic opacity-80">Ainda ninguém teve coragem.</p>
        ) : (
          <ul className="divide-y divide-[#fff6d6]/20 text-sm">
            {duels.arena.map((d) => {
              const winnerIsChallenger = d.winner_id === d.challenger_id;
              const [w, l] = winnerIsChallenger ? [d.challenger, d.opponent] : [d.opponent, d.challenger];
              const verb = VERBS[d.id % VERBS.length];
              return (
                <li key={d.id} className="py-2">
                  <span className="mr-2 text-lg">
                    {moveEmoji(d.challenger_move)} vs {moveEmoji(d.opponent_move)}
                  </span>
                  {d.winner_id === null ? (
                    <span>
                      {d.challenger} e {d.opponent} empataram ({d.stake} ☕).
                    </span>
                  ) : (
                    <span>
                      <strong className={gold}>{w}</strong> {verb} {l} e levou {duelPrize(d.stake, R.duelHouseCutPct)} ☕.
                    </span>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <Disclaimer />
    </div>
  );
}
