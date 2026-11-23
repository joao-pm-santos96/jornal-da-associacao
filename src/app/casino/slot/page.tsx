import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { getBalances } from "@/lib/economy";
import { SLOT_SYMBOLS, expectedReturn } from "@/lib/slot-table";
import { Disclaimer, Marquee, felt, gold } from "../Decor";
import { SlotMachine } from "./SlotMachine";

export default async function SlotPage() {
  const user = await requireUser();
  const balance = (await getBalances()).find((b) => b.user_id === user.id)?.balance ?? 0;
  const rtp = Math.round(expectedReturn() * 100);

  return (
    <div className={`-mx-4 -my-6 space-y-8 px-4 py-6 sm:mx-0 sm:border-4 sm:border-[#141414] ${felt}`}>
      <Marquee small />
      <p className="text-sm">
        <Link href="/casino" className="underline">← Voltar às mesas</Link>
      </p>

      <SlotMachine initialBalance={balance} />

      <section className="mx-auto max-w-sm">
        <h2 className={`border-b-2 border-dashed border-[#f2c230] pb-1 text-center font-display text-2xl font-black uppercase ${gold}`}>
          Tabela de prémios
        </h2>
        <table className="mt-2 w-full text-sm">
          <thead className="text-[11px] uppercase tracking-wider opacity-70">
            <tr>
              <th className="py-1 text-left font-bold">Símbolo</th>
              <th className="py-1 text-right font-bold">Três</th>
              <th className="py-1 text-right font-bold">Dois</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#fff6d6]/20">
            {[...SLOT_SYMBOLS].reverse().map((s) => (
              <tr key={s.emoji}>
                <td className="py-1.5">
                  <span className="mr-2 text-xl">{s.emoji}</span>
                  <span className="opacity-80">{s.name}</span>
                </td>
                <td className={`py-1.5 text-right font-display text-lg font-black ${gold}`}>×{s.triple}</td>
                <td className="py-1.5 text-right font-bold">{s.pair === 1 ? "devolve" : `×${s.pair}`}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="mt-3 text-center text-xs opacity-80">
          Em média, a máquina devolve {rtp}% do que engole. O resto vai para o Cofre. Só joga quem tem saldo para a aposta.
        </p>
      </section>

      <Disclaimer />
    </div>
  );
}
