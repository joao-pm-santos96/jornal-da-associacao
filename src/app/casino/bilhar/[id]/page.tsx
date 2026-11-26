import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { formatSchedule } from "@/lib/dates";
import { getRules } from "@/lib/rules";
import { FINISH_LABEL, getPoolGame, poolPrize } from "@/lib/pool-games";
import { onTheEight, remaining, type Group, type Seat } from "@/lib/pool-rules";
import { ConfirmButton } from "@/components/ConfirmButton";
import { Disclaimer, Marquee, felt } from "../../Decor";
import { forfeitPool } from "../actions";
import { BallChip, PoolTable } from "../PoolTable";
import { Celebration } from "../Celebration";

const GROUP_BALLS: Record<Group, number[]> = { lisas: [1, 2, 3, 4, 5, 6, 7], riscadas: [9, 10, 11, 12, 13, 14, 15] };

export default async function PoolGamePage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const id = Number((await params).id);
  if (!Number.isInteger(id) || id <= 0) notFound();
  const [game, R] = await Promise.all([getPoolGame(id), getRules()]);
  if (!game || !game.state || (game.status !== "active" && game.status !== "finished")) notFound();
  const state = game.state;
  const players = [
    { id: game.challenger_id, name: game.challenger },
    { id: game.opponent_id, name: game.opponent },
  ];
  const me = players.findIndex((p) => p.id === user.id);
  const active = game.status === "active";
  const myTurn = active && game.turn_id === user.id;
  const turnName = players.find((p) => p.id === game.turn_id)?.name ?? "";
  const winnerName = players.find((p) => p.id === game.winner_id)?.name ?? "";
  const seat = me >= 0 ? (me as Seat) : null;
  const myGroup = seat === null ? null : state.groups[seat];
  const legal =
    seat === null || !state.broken
      ? null
      : myGroup === null
        ? state.balls.filter((b) => b.id !== 0 && b.id !== 8 && !b.pocketed).map((b) => b.id)
        : onTheEight(state, seat)
          ? [8]
          : remaining(state.balls, myGroup);
  const goal = !state.broken
    ? "Abertura: acerta no triângulo"
    : myGroup === null
      ? "Mesa aberta: bate primeiro em qualquer bola menos a preta"
      : seat !== null && onTheEight(state, seat)
        ? "Só te falta a preta: bate primeiro nela"
        : `Jogas às ${myGroup}: bate primeiro numa delas`;
  const lastBy = players.find((p) => p.id === game.last_shot?.by)?.name;
  const recap = game.last_shot && lastBy ? `${lastBy}: ${game.last_shot.summary} ` : "";
  const prompt = recap + (!active
    ? `Partida terminada: ganhou ${winnerName} ${FINISH_LABEL[game.finish_reason ?? ""] ?? ""}.`
    : myTurn
      ? state.ballInHand
        ? "É a tua vez, com a branca na mão: toca na mesa para a pores onde quiseres."
        : state.broken
          ? "É a tua vez."
          : "Tu abres: aponta ao triângulo e dá-lhe com força."
      : `Vez de ${turnName}.${me >= 0 ? " Avisamos-te quando for a tua." : ""}`);

  return (
    <div className={`-mx-4 -my-6 space-y-5 px-4 py-6 sm:mx-0 sm:border-4 sm:border-[#141414] ${felt}`}>
      <Marquee small />
      <p className="text-sm">
        <Link href="/casino/bilhar" className="underline">← Bilhar</Link>
      </p>
      <header className="text-center">
        <p className="text-xs font-black uppercase tracking-widest text-[#f2c230]">
          Partida n.º {game.id} · {game.stake > 0 ? `${game.stake} ☕ cada · prémio ${poolPrize(game.stake, R.poolHouseCutPct)} ☕` : "amigável"}
        </p>
        <h1 className="font-display text-3xl font-black">{game.challenger} vs {game.opponent}</h1>
        {active && game.deadline_at && <p className="text-xs opacity-80">{turnName} joga até {formatSchedule(game.deadline_at)}</p>}
      </header>

      {!active && (
        <p className="mx-auto max-w-xl border-4 border-[#141414] bg-[#f2c230] p-3 text-center font-display text-2xl font-black text-[#141414]">
          🏆 Ganhou {winnerName} {FINISH_LABEL[game.finish_reason ?? ""] ?? ""}
        </p>
      )}

      <div className="mx-auto grid max-w-2xl grid-cols-2 gap-3">
        {players.map((p, i) => {
          const group = state.groups[i];
          const turn = active && game.turn_id === p.id;
          return (
            <div key={p.id} className={`border-2 border-[#141414] bg-[#fff6d6] p-2 text-[#141414] ${turn ? "outline outline-4 outline-[#f2c230]" : ""}`}>
              <p className="truncate font-bold">{turn && "🎱 "}{p.name}</p>
              <p className="text-xs font-semibold uppercase tracking-wider">
                {group ? (onTheEight(state, i as Seat) ? `${group} · falta a preta` : group) : "mesa aberta"}
              </p>
              {group && (
                <p className="mt-1">
                  {GROUP_BALLS[group].map((b) => (
                    <BallChip key={b} id={b} faded={!remaining(state.balls, group).includes(b)} />
                  ))}
                </p>
              )}
            </div>
          );
        })}
      </div>

      {!active && game.winner_id !== null && (
        <Celebration
          gameId={game.id}
          finalShot={game.shots}
          winner={winnerName}
          line={
            game.winner_id === user.id
              ? `Ganhaste ${FINISH_LABEL[game.finish_reason ?? ""] ?? ""}${game.stake > 0 ? ` e levas ${poolPrize(game.stake, R.poolHouseCutPct)} ☕` : ""}!`
              : me >= 0
                ? "Para a próxima, afia o taco."
                : `Ganhou ${FINISH_LABEL[game.finish_reason ?? ""] ?? ""}.`
          }
        />
      )}

      <PoolTable
        key={game.shots}
        match={{
          gameId: game.id,
          shots: game.shots,
          balls: state.balls,
          myTurn,
          ballInHand: state.ballInHand,
          active,
          prompt,
          replay: game.last_shot,
          legal,
          goal,
        }}
      />

      {active && me >= 0 && (
        <form action={forfeitPool.bind(null, game.id)} className="text-center">
          <ConfirmButton message="Desistir da partida? O adversário ganha e leva o pote." className="text-sm text-[#fff6d6] underline opacity-80">
            🏳️ Desistir
          </ConfirmButton>
        </form>
      )}

      <Disclaimer />
    </div>
  );
}
