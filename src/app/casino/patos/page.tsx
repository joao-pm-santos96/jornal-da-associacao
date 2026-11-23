import Link from "next/link";
import { after } from "next/server";
import { requireUser } from "@/lib/auth";
import { sql } from "@/lib/db";
import { getBalances } from "@/lib/economy";
import { formatDateTime, formatSchedule } from "@/lib/dates";
import { ensureOpenRace, finishedRaces, raceBoard, raceWagers, resolveDueRaces } from "@/lib/ducks";
import { DUCKS, RACE_HOUSE_CUT_PCT, duckName } from "@/lib/ducks-table";
import { notifyRaceResults } from "@/lib/push";
import { Disclaimer, Marquee, Sticker, felt, gold } from "../Decor";
import { DuckBetForm } from "./DuckBetForm";
import { RaceTrack } from "./RaceTrack";

const odds = new Intl.NumberFormat("pt-PT", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export default async function DuckRacePage() {
  const user = await requireUser();
  const settled = await resolveDueRaces();
  if (settled.length > 0) after(() => notifyRaceResults(settled));
  const race = await ensureOpenRace();
  const [board, balances, past, mine] = await Promise.all([
    raceBoard(race.id),
    getBalances(),
    finishedRaces(6),
    sql`SELECT duck, sum(amount)::int AS amount FROM duck_bets WHERE race_id = ${race.id} AND user_id = ${user.id} GROUP BY duck`,
  ]);
  const balance = balances.find((b) => b.user_id === user.id)?.balance ?? 0;
  const pot = board.reduce((sum, o) => sum + o.total, 0);
  const net = pot - Math.ceil((pot * RACE_HOUSE_CUT_PCT) / 100);
  const last = past[0] ?? null;
  const lastWagers = last ? await raceWagers(last.id) : [];
  const myBets = mine as { duck: number; amount: number }[];

  return (
    <div className={`-mx-4 -my-6 space-y-8 px-4 py-6 sm:mx-0 sm:border-4 sm:border-[#141414] ${felt}`}>
      <Marquee small />
      <p className="text-sm">
        <Link href="/casino" className="underline">← Voltar às mesas</Link>
      </p>

      <header className="text-center">
        <h1 className={`font-display text-4xl font-black uppercase ${gold}`}>🦆 Corrida de Patos</h1>
        <p className="text-sm">Todos os domingos às 21h · apostas mútuas · a casa fica com {RACE_HOUSE_CUT_PCT}%</p>
      </header>

      <section className="relative mx-auto max-w-2xl border-2 border-dashed border-[#141414] bg-[#fff6d6] p-4 text-[#141414] outline outline-4 outline-[#fff6d6]">
        <Sticker className="absolute -right-2 -top-3">Apostas abertas</Sticker>
        <p className="text-xs font-black uppercase tracking-widest text-[#e10600]">Corrida n.º {race.id}</p>
        <p className="font-display text-2xl font-black">Partida {formatSchedule(race.race_at)}</p>
        <p className="text-sm">
          {pot} ☕ no pote · {net} ☕ para quem acertar
        </p>
        <ul className="mt-3 divide-y divide-[#141414]/15">
          {board.map((o) => {
            const d = DUCKS.find((x) => x.n === o.duck)!;
            return (
              <li key={o.duck} className="flex items-center justify-between gap-2 py-1.5 text-sm">
                <span className="flex items-center gap-2 font-bold">
                  <span className="rounded px-1.5 text-xs font-black text-white" style={{ backgroundColor: d.color }}>{d.n}</span>
                  {d.name}
                </span>
                <span className="text-right">
                  {o.total} ☕
                  <span className="block text-xs text-muted">
                    {o.total > 0 ? `paga ${odds.format(net / o.total)} por 1` : "ninguém acredita nele"}
                  </span>
                </span>
              </li>
            );
          })}
        </ul>
        {myBets.length > 0 && (
          <p className="mt-3 border-t-2 border-dashed border-[#141414] pt-2 text-sm font-bold">
            As tuas apostas: {myBets.map((b) => `${b.amount} ☕ no ${duckName(b.duck)}`).join(" · ")}
          </p>
        )}
        <div className="mt-4">
          <DuckBetForm raceId={race.id} balance={balance} />
        </div>
        <p className="mt-2 text-xs text-muted">As apostas fecham à hora da partida. O vencedor é sorteado e cada pato tem as mesmas hipóteses.</p>
      </section>

      {last && last.seed && last.winner && (
        <section className="mx-auto max-w-2xl space-y-3">
          <h2 className={`border-b-2 border-dashed border-[#f2c230] pb-1 font-display text-2xl font-black uppercase ${gold}`}>
            Última corrida (n.º {last.id})
          </h2>
          <p className="text-sm">
            {formatDateTime(last.race_at)} · ganhou o <strong className={gold}>{duckName(last.winner)}</strong>
          </p>
          <RaceTrack seed={last.seed} winner={last.winner} />
          {lastWagers.length > 0 ? (
            <ul className="divide-y divide-[#fff6d6]/20 text-sm">
              {lastWagers.map((w) => (
                <li key={`${w.user_id}-${w.duck}`} className="flex justify-between py-1">
                  <span>{w.name}</span>
                  <span className={w.duck === last.winner ? `font-bold ${gold}` : ""}>
                    {w.amount} ☕ no {duckName(w.duck)}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm italic opacity-80">Ninguém apostou. Os patos correram para ninguém.</p>
          )}
        </section>
      )}

      {past.length > 1 && (
        <section className="mx-auto max-w-2xl">
          <h2 className={`border-b-2 border-dashed border-[#f2c230] pb-1 font-display text-xl font-black uppercase ${gold}`}>Palmarés</h2>
          <ul className="text-sm">
            {past.slice(1).map((r) => (
              <li key={r.id} className="flex justify-between py-1">
                <span>n.º {r.id} · {formatDateTime(r.race_at)}</span>
                <span className="font-bold">{r.winner ? duckName(r.winner) : "—"}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <Disclaimer />
    </div>
  );
}
