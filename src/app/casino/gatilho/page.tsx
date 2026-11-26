import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { sql } from "@/lib/db";
import { formatSchedule } from "@/lib/dates";
import { getBalances } from "@/lib/economy";
import { getRules } from "@/lib/rules";
import { ATTEMPTS, average, reflexPrize } from "@/lib/reflex";
import { REFLEX_FINISH_LABEL, listReflexGames, type ReflexGame } from "@/lib/reflex-games";
import { ConfirmButton } from "@/components/ConfirmButton";
import { Disclaimer, Marquee, felt, gold } from "../Decor";
import { cancelReflex, respondReflex } from "./actions";
import { ChallengeForm } from "./ReflexForms";

const card = "block border-2 border-dashed border-[#141414] bg-[#fff6d6] p-3 text-[#141414]";

function stakeLine(g: ReflexGame, cut: number): string {
  return g.stake > 0 ? `${g.stake} ☕ cada · prémio ${reflexPrize(g.stake, cut)} ☕` : "amigável";
}

function resultLine(g: ReflexGame): string {
  if (g.finish_reason === "tempo") return `ganhou ${g.winner_id === g.challenger_id ? g.challenger : g.opponent} ${REFLEX_FINISH_LABEL.tempo}`;
  const score = `${average(g.challenger_times)} ms vs ${average(g.opponent_times)} ms`;
  if (g.winner_id === null) return `empate · ${score}`;
  return `ganhou ${g.winner_id === g.challenger_id ? g.challenger : g.opponent} · ${score}`;
}

export default async function ReflexLobbyPage() {
  const user = await requireUser();
  const R = await getRules();
  const [games, memberRows, balances] = await Promise.all([
    listReflexGames(),
    sql`SELECT id, name FROM users WHERE id <> ${user.id} ORDER BY name`,
    getBalances(),
  ]);
  const members = memberRows as { id: number; name: string }[];
  const balance = balances.find((b) => b.user_id === user.id)?.balance ?? 0;
  const incoming = games.filter((g) => g.status === "pending" && g.opponent_id === user.id);
  const outgoing = games.filter((g) => g.status === "pending" && g.challenger_id === user.id);
  const active = games.filter((g) => g.status === "active");
  const finished = games.filter((g) => g.status === "finished");

  return (
    <div className={`-mx-4 -my-6 space-y-8 px-4 py-6 sm:mx-0 sm:border-4 sm:border-[#141414] ${felt}`}>
      <Marquee small />
      <p className="text-sm">
        <Link href="/casino" className="underline">← Voltar às mesas</Link>
      </p>
      <header className="text-center">
        <h1 className={`font-display text-4xl font-black uppercase ${gold} [text-shadow:3px_3px_0_#141414]`}>⚡ Gatilho</h1>
        <p className="text-sm">
          Quem toca mais depressa quando o ecrã fica verde. Cada um joga {ATTEMPTS} tentativas na sua vez e ganha a melhor média. A casa fica com {R.reflexHouseCutPct}% do pote.{" "}
          <Link href="/casino/gatilho/treino" className="font-bold underline">Treinar</Link> ·{" "}
          <Link href="/regras#casino" className="underline">Regulamento</Link>
        </p>
      </header>

      <section className="mx-auto max-w-2xl space-y-2 border-4 border-double border-[#f2c230] bg-[#08502b] p-4">
        <h2 className={`font-display text-2xl font-black ${gold}`}>Desafiar um sócio</h2>
        <ChallengeForm members={members} minStake={R.reflexMinStake} balance={balance} />
      </section>

      {incoming.length > 0 && (
        <section className="mx-auto max-w-2xl space-y-2">
          <h2 className={`font-display text-2xl font-black ${gold}`}>Desafios para ti</h2>
          <ul className="space-y-2">
            {incoming.map((g) => (
              <li key={g.id} className={`${card} flex flex-wrap items-center justify-between gap-2`}>
                <span>
                  <strong>{g.challenger}</strong> desafia-te · {stakeLine(g, R.reflexHouseCutPct)}
                </span>
                <span className="flex gap-2">
                  <form action={respondReflex.bind(null, g.id, true)}>
                    <ConfirmButton message={g.stake > 0 ? `Aceitar e pôr ${g.stake} ☕ em jogo?` : "Aceitar o desafio?"}
                      className="bg-[#141414] px-3 py-1 text-xs font-bold uppercase text-[#f2c230]">Aceitar</ConfirmButton>
                  </form>
                  <form action={respondReflex.bind(null, g.id, false)}>
                    <button className="px-2 py-1 text-xs font-bold uppercase text-[#e10600] underline">Recusar</button>
                  </form>
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {outgoing.length > 0 && (
        <section className="mx-auto max-w-2xl space-y-2">
          <h2 className={`font-display text-2xl font-black ${gold}`}>À espera de resposta</h2>
          <ul className="space-y-2">
            {outgoing.map((g) => (
              <li key={g.id} className={`${card} flex flex-wrap items-center justify-between gap-2`}>
                <span>
                  Desafiaste <strong>{g.opponent}</strong> · {stakeLine(g, R.reflexHouseCutPct)}
                </span>
                <form action={cancelReflex.bind(null, g.id)}>
                  <button className="text-xs font-bold uppercase text-[#e10600] underline">Cancelar</button>
                </form>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="mx-auto max-w-2xl space-y-2">
        <h2 className={`font-display text-2xl font-black ${gold}`}>Partidas a decorrer</h2>
        {active.length === 0 && <p className="text-sm italic opacity-80">Ninguém está a jogar. Os dedos estão a ganhar pó.</p>}
        <ul className="space-y-2">
          {active.map((g) => {
            const mine = g.challenger_id === user.id || g.opponent_id === user.id;
            const myTurn = g.turn_id === user.id;
            const turnName = g.turn_id === g.challenger_id ? g.challenger : g.opponent;
            return (
              <li key={g.id}>
                <Link href={`/casino/gatilho/${g.id}`} className={`${card} hover:bg-[#f2c230] ${myTurn ? "outline outline-4 outline-[#e10600]" : ""}`}>
                  <span className="flex flex-wrap items-baseline justify-between gap-2 text-xs font-black uppercase tracking-widest">
                    <span className="text-[#e10600]">Gatilho n.º {g.id}</span>
                    <span>{stakeLine(g, R.reflexHouseCutPct)}</span>
                  </span>
                  <span className="mt-1 block font-display text-xl font-black">{g.challenger} vs {g.opponent}</span>
                  <span className="block text-sm font-bold">
                    {myTurn ? "⚡ É a tua vez!" : `Vez de ${turnName}${mine ? "" : " · ver"}`}
                    {g.deadline_at && ` · joga até ${formatSchedule(g.deadline_at)}`}
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      </section>

      {finished.length > 0 && (
        <section className="mx-auto max-w-2xl">
          <h2 className={`border-b-2 border-dashed border-[#f2c230] pb-1 font-display text-2xl font-black ${gold}`}>Partidas acabadas</h2>
          <ul className="divide-y divide-[#f2c230]/30">
            {finished.map((g) => (
              <li key={g.id}>
                <Link href={`/casino/gatilho/${g.id}`} className="flex flex-wrap items-baseline justify-between gap-2 py-2 hover:text-[#f2c230]">
                  <span>
                    <span className="text-xs font-black uppercase tracking-widest opacity-70">n.º {g.id} · </span>
                    <span className="font-bold">{g.challenger} vs {g.opponent}</span>
                  </span>
                  <span className="text-sm">{resultLine(g)}</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      <Disclaimer />
    </div>
  );
}
