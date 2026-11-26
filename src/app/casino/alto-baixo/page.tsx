import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { getBalances } from "@/lib/economy";
import { getRules } from "@/lib/rules";
import { activeHilo } from "@/lib/hilo-games";
import { Disclaimer, Marquee, felt, gold } from "../Decor";
import { HiloTable } from "./HiloTable";

export default async function HiloPage() {
  const user = await requireUser();
  const [R, balances, game] = await Promise.all([getRules(), getBalances(), activeHilo(user.id)]);
  const balance = balances.find((b) => b.user_id === user.id)?.balance ?? 0;
  return (
    <div className={`-mx-4 -my-6 space-y-6 px-4 py-6 sm:mx-0 sm:border-4 sm:border-[#141414] ${felt}`}>
      <Marquee small />
      <p className="text-sm">
        <Link href="/casino" className="underline">← Voltar às mesas</Link>
      </p>
      <header className="text-center">
        <h1 className={`font-display text-4xl font-black uppercase ${gold} [text-shadow:3px_3px_0_#141414]`}>🃏 Alto ou Baixo</h1>
        <p className="text-sm">A próxima carta é mais alta ou mais baixa? Cada acerto multiplica a aposta. Recolhe a tempo, ou perde tudo.</p>
      </header>

      <HiloTable initialGame={game} initialBalance={balance} minBet={R.hiloMinBet} maxBet={R.hiloMaxBet} edgePct={R.hiloEdgePct} maxMult={R.hiloMaxMult} />

      <section className="mx-auto max-w-xl space-y-1 text-sm">
        <h2 className={`border-b-2 border-dashed border-[#f2c230] pb-1 font-display text-xl font-black uppercase ${gold}`}>Como se joga</h2>
        <ul className="list-disc space-y-1 pl-5">
          <li>Apostas e sai uma carta. Dizes se a próxima é mais alta ou mais baixa. O Ás é a mais baixa e o Rei a mais alta.</li>
          <li>Cada acerto multiplica o que tens em jogo: quanto menos provável, mais paga (o valor está em cada botão). Uma carta igual conta como errada.</li>
          <li>Depois do primeiro acerto podes recolher quando quiseres. Se errares, perdes a aposta.</li>
          <li>O baralho é baralhado a cada carta, por isso contar cartas não serve de nada. A casa fica com {R.hiloEdgePct}% em cada palpite e paga no máximo ×{R.hiloMaxMult}.</li>
          <li>Se saíres a meio, a mão fica à tua espera.</li>
        </ul>
      </section>

      <Disclaimer />
    </div>
  );
}
