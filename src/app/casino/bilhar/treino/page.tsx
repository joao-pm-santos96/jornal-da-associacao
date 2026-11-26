import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { Disclaimer, Marquee, felt, gold } from "../../Decor";
import { PoolTable } from "../PoolTable";

export default async function PoolPracticePage() {
  await requireUser();
  return (
    <div className={`-mx-4 -my-6 space-y-6 px-4 py-6 sm:mx-0 sm:border-4 sm:border-[#141414] ${felt}`}>
      <Marquee small />
      <p className="text-sm">
        <Link href="/casino" className="underline">← Voltar às mesas</Link>
      </p>
      <header className="text-center">
        <h1 className={`font-display text-4xl font-black uppercase ${gold} [text-shadow:3px_3px_0_#141414]`}>🎱 Bilhar</h1>
        <p className="text-sm font-bold uppercase tracking-widest">Mesa de treino · sem grãos em jogo</p>
      </header>

      <PoolTable />

      <section className="mx-auto max-w-xl space-y-1 text-sm">
        <h2 className={`border-b-2 border-dashed border-[#f2c230] pb-1 font-display text-xl font-black uppercase ${gold}`}>Como se joga</h2>
        <ul className="list-disc space-y-1 pl-5">
          <li>Toca ou arrasta na mesa para apontar: a branca vai na direção do dedo.</li>
          <li>A linha tracejada mostra onde a branca bate; a amarela, para onde segue a bola atingida.</li>
          <li>Afina a mira com ↺ e ↻, escolhe a força e carrega em <strong>Tacar</strong>.</li>
          <li>Se a branca for ao buraco, toca na mesa para a pôres onde quiseres.</li>
          <li>Isto é só para treinar: as partidas a sério, contra outros sócios e com grãos, vêm a seguir.</li>
        </ul>
      </section>

      <Disclaimer />
    </div>
  );
}
