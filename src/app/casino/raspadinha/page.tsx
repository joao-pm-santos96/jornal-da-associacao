import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { sql } from "@/lib/db";
import { SCRATCH_ODDS_BASE, scratchReturn, scratchWinChance } from "@/lib/scratch-table";
import { getRules, scratchPrizes } from "@/lib/rules";
import { Disclaimer, Marquee, felt, gold } from "../Decor";
import { ScratchCard } from "./ScratchCard";
import type { Ticket } from "./actions";

export default async function ScratchPage() {
  const user = await requireUser();
  const R = await getRules();
  const { scratchCost } = R;
  const prizes = scratchPrizes(R);
  const [pending] = (await sql`
    SELECT id, cells, prize, cost FROM scratch_tickets
    WHERE user_id = ${user.id} AND scratched_at IS NULL
    ORDER BY id DESC LIMIT 1
  `) as { id: number; cells: string; prize: number; cost: number }[];
  const initial: Ticket | null = pending ? { id: pending.id, cells: pending.cells.split(","), prize: pending.prize, cost: pending.cost } : null;

  return (
    <div className={`-mx-4 -my-6 space-y-8 px-4 py-6 sm:mx-0 sm:border-4 sm:border-[#141414] ${felt}`}>
      <Marquee small />
      <p className="text-sm">
        <Link href="/casino" className="underline">← Voltar às mesas</Link>
      </p>

      <ScratchCard initial={initial} price={scratchCost} />

      <section className="mx-auto max-w-sm">
        <h2 className={`border-b-2 border-dashed border-[#f2c230] pb-1 text-center font-display text-2xl font-black uppercase ${gold}`}>
          Prémios
        </h2>
        <ul className="mt-2 divide-y divide-[#fff6d6]/20 text-sm">
          {prizes.filter((p) => p.chances > 0).map((p) => (
            <li key={p.emoji} className="flex items-center justify-between py-1.5">
              <span className="text-xl tracking-widest">{p.emoji.repeat(3)}</span>
              <span className="opacity-80">1 em {Math.round(SCRATCH_ODDS_BASE / p.chances)}</span>
              <span className={`font-display text-lg font-black ${gold}`}>
                {p.multiplier === 0 ? "nada" : p.multiplier === 1 ? "devolve" : `${scratchCost * p.multiplier} ☕`}
              </span>
            </li>
          ))}
        </ul>
        <p className="mt-3 text-center text-xs opacity-80">
          Sai prémio em {Math.round(scratchWinChance(prizes) * 100)}% dos bilhetes. Em média devolve {Math.round(scratchReturn(prizes) * 100)}% do que
          custam. Prémios e probabilidades são decididos pelo Tesoureiro.
        </p>
      </section>

      <Disclaimer />
    </div>
  );
}
