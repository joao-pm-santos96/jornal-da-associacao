import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { formatSchedule } from "@/lib/dates";
import { getRules } from "@/lib/rules";
import { ATTEMPTS, average, formatMs, reflexPrize } from "@/lib/reflex";
import { REFLEX_FINISH_LABEL, getReflexGame, timesOf } from "@/lib/reflex-games";
import { Disclaimer, Marquee, felt, gold } from "../../Decor";
import { ReflexPad } from "../ReflexPad";

function Times({ name, times, winner }: { name: string; times: number[]; winner: boolean }) {
  return (
    <div className={`border-4 border-[#141414] p-3 text-[#141414] ${winner ? "bg-[#f2c230]" : "bg-[#fff6d6]"}`}>
      <p className="font-display text-xl font-black">{winner && "🏆 "}{name}</p>
      <ol className="mt-1 flex gap-2 text-sm font-bold">
        {Array.from({ length: ATTEMPTS }, (_, i) => (
          <li key={i} className="flex-1 border-2 border-[#141414] bg-white p-1 text-center">{times[i] === undefined ? "—" : `${times[i]} ms`}</li>
        ))}
      </ol>
      <p className="mt-1 text-sm">Média: <strong>{times.length === ATTEMPTS ? formatMs(average(times)) : "—"}</strong></p>
    </div>
  );
}

export default async function ReflexGamePage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const id = Number((await params).id);
  if (!Number.isInteger(id) || id <= 0) notFound();
  const [game, R] = await Promise.all([getReflexGame(id), getRules()]);
  if (!game || (game.status !== "active" && game.status !== "finished")) notFound();
  const active = game.status === "active";
  const myTurn = active && game.turn_id === user.id;
  const player = user.id === game.challenger_id || user.id === game.opponent_id;
  const turnName = game.turn_id === game.challenger_id ? game.challenger : game.opponent;
  const mine = player ? timesOf(game, user.id) : [];
  const prize = reflexPrize(game.stake, R.reflexHouseCutPct);

  return (
    <div className={`-mx-4 -my-6 space-y-5 px-4 py-6 sm:mx-0 sm:border-4 sm:border-[#141414] ${felt}`}>
      <Marquee small />
      <p className="text-sm">
        <Link href="/casino/gatilho" className="underline">← Voltar ao Gatilho</Link>
      </p>
      <header className="text-center">
        <p className="text-xs font-black uppercase tracking-widest text-[#f2c230]">Gatilho n.º {game.id} · {game.stake > 0 ? `${game.stake} ☕ cada · prémio ${prize} ☕` : "amigável"}</p>
        <h1 className={`font-display text-3xl font-black ${gold} [text-shadow:3px_3px_0_#141414]`}>{game.challenger} vs {game.opponent}</h1>
      </header>

      {active ? (
        <>
          <p className="text-center text-sm font-bold">
            {myTurn ? "É a tua vez. Os tempos do adversário só aparecem no fim." : `Vez de ${turnName}.${player ? " Avisamos-te quando houver novidades." : ""}`}
            {game.deadline_at && ` Prazo: ${formatSchedule(game.deadline_at)}.`}
          </p>
          {myTurn ? (
            <div className="mx-auto max-w-md space-y-2">
              {game.attempt_open && (
                <p className="border-2 border-[#e10600] bg-white p-2 text-sm font-semibold text-[#e10600]">
                  Deixaste uma tentativa a meio: ao continuar, conta como falhada (1 segundo).
                </p>
              )}
              <ReflexPad key={mine.length} mode="match" gameId={game.id} initialTimes={mine} />
            </div>
          ) : (
            player && mine.length > 0 && (
              <div className="mx-auto max-w-md">
                <Times name="Os teus tempos" times={mine} winner={false} />
              </div>
            )
          )}
        </>
      ) : (
        <div className="mx-auto max-w-md space-y-3">
          <p className="text-center font-display text-2xl font-black text-[#f2c230]">
            {game.winner_id === null
              ? "Empate! Cada um ficou com o seu."
              : `Ganhou ${game.winner_id === game.challenger_id ? game.challenger : game.opponent}${game.finish_reason ? ` ${REFLEX_FINISH_LABEL[game.finish_reason] ?? ""}` : ""}${game.stake > 0 ? ` · +${prize} ☕` : ""}`}
          </p>
          <Times name={game.challenger} times={game.challenger_times} winner={game.winner_id === game.challenger_id} />
          <Times name={game.opponent} times={game.opponent_times} winner={game.winner_id === game.opponent_id} />
        </div>
      )}

      <Disclaimer />
    </div>
  );
}
