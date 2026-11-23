import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { listBets, STATUS_LABEL } from "@/lib/bets";
import { formatSchedule } from "@/lib/dates";
import { GRAOS, getBalances } from "@/lib/economy";
import { NewBetForm } from "./BetForms";
import { Disclaimer, Marquee, Sticker, felt, gold } from "./Decor";

export default async function CasinoPage() {
  const user = await requireUser();
  const [bets, balances] = await Promise.all([listBets(), getBalances()]);
  const balance = balances.find((b) => b.user_id === user.id)?.balance ?? 0;
  const open = bets.filter((b) => b.status === "open" || b.status === "closed");
  const past = bets.filter((b) => b.status === "resolved" || b.status === "void");

  return (
    <div className={`-mx-4 -my-6 space-y-8 px-4 py-6 sm:mx-0 sm:border-4 sm:border-[#141414] ${felt}`}>
      <Marquee />

      <p className="text-center text-sm">
        A casa fica com <strong className={gold}>{GRAOS.betHouseCutPct}%</strong> de cada pote. Abrir uma mesa custa{" "}
        <strong className={gold}>{GRAOS.betOpenFee} ☕</strong> de licença.{" "}
        <Link href="/regras#casino" className="underline">Regulamento</Link>
      </p>

      <details className="mx-auto max-w-2xl border-4 border-double border-[#f2c230] bg-[#08502b]">
        <summary className="cursor-pointer list-none p-4 text-center font-display text-2xl font-black">
          🎰 Abrir uma mesa <Sticker className="ml-1 align-middle">licença {GRAOS.betOpenFee} ☕</Sticker>
        </summary>
        <div className="border-t-2 border-dashed border-[#f2c230] p-4">
          <NewBetForm balance={balance} fee={GRAOS.betOpenFee} />
        </div>
      </details>

      <section className="mx-auto grid max-w-2xl grid-cols-2 gap-4">
        {[
          { href: "/casino/slot", icon: "🦆☕🐕", title: "Slot machine", sub: "Jackpot ×100", rot: "-rotate-1" },
          { href: "/casino/raspadinha", icon: "🎟️", title: "Raspadinha", sub: "Raspa o Bacalhau · 2 ☕", rot: "rotate-1" },
          { href: "/casino/patos", icon: "🦆🏁", title: "Corrida de Patos", sub: "Domingos às 21h", rot: "rotate-1" },
          { href: "/casino/duelos", icon: "⚔️", title: "Duelos", sub: "Pedra, papel, tesoura", rot: "-rotate-1" },
        ].map((g) => (
          <Link
            key={g.href}
            href={g.href}
            className={`block ${g.rot} border-4 border-[#141414] bg-[#e10600] p-3 text-center shadow-[5px_5px_0_#141414] transition hover:rotate-0`}
          >
            <span className="block text-3xl tracking-widest" aria-hidden="true">{g.icon}</span>
            <span className="block font-display text-xl font-black uppercase leading-tight text-[#f2c230] [text-shadow:2px_2px_0_#141414]">{g.title}</span>
            <span className="block text-xs font-bold text-white">{g.sub}</span>
          </Link>
        ))}
      </section>

      <section className="space-y-3">
        <h2 className={`text-center font-display text-3xl font-black uppercase ${gold}`}>Mesas abertas</h2>
        {open.length === 0 && (
          <p className="text-center italic opacity-80">Não há mesas abertas. O crupiê foi fumar um cigarro.</p>
        )}
        <ul className="grid gap-4 sm:grid-cols-2">
          {open.map((b, i) => (
            <li key={b.id}>
              <Link
                href={`/casino/${b.id}`}
                className={`block border-2 border-dashed border-[#141414] bg-[#fff6d6] p-4 text-[#141414] outline outline-4 outline-[#fff6d6] transition hover:-rotate-1 hover:bg-[#f2c230] ${
                  i % 2 ? "rotate-1" : "-rotate-1"
                }`}
              >
                <span className="flex items-baseline justify-between text-xs font-black uppercase tracking-widest">
                  <span className="text-[#e10600]">Mesa n.º {b.id}</span>
                  <span>{b.status === "open" ? `fecha ${formatSchedule(b.closes_at)}` : STATUS_LABEL.closed}</span>
                </span>
                <span className="mt-1 block font-display text-2xl font-black leading-tight">{b.title}</span>
                <span className="mt-2 flex items-center gap-2 text-sm font-bold">
                  <span className="rounded-full border-2 border-dashed border-white bg-[#e10600] px-2 py-0.5 text-white outline outline-2 outline-[#141414]">
                    {b.pot} ☕
                  </span>
                  {b.bettors} {b.bettors === 1 ? "apostador" : "apostadores"}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </section>

      {past.length > 0 && (
        <section className="mx-auto max-w-2xl">
          <h2 className={`border-b-2 border-dashed border-[#f2c230] pb-1 font-display text-2xl font-black ${gold}`}>
            Mesas encerradas
          </h2>
          <ul className="divide-y divide-[#f2c230]/30">
            {past.map((b) => (
              <li key={b.id}>
                <Link href={`/casino/${b.id}`} className="flex flex-wrap items-baseline justify-between gap-2 py-2 hover:text-[#f2c230]">
                  <span>
                    <span className="text-xs font-black uppercase tracking-widest opacity-70">n.º {b.id} · </span>
                    <span className="font-bold">{b.title}</span>
                  </span>
                  <span className="text-sm">
                    {b.status === "resolved" ? `saiu «${b.winner}» · ${b.pot} ☕` : "anulada"}
                  </span>
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
