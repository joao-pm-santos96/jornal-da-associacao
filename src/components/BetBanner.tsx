import Link from "next/link";
import type { BetSummary } from "@/lib/bets";
import { formatSchedule } from "@/lib/dates";

export function BetBanner({ bet }: { bet: BetSummary | null }) {
  if (!bet) return null;
  return (
    <Link
      href={`/casino/${bet.id}`}
      className="block border-[5px] border-dotted border-[#f2c230] bg-[#0b6b3a] p-3 text-[#fff6d6] hover:bg-[#08502b]"
    >
      <p className="text-xs font-black uppercase tracking-widest text-[#f2c230]">🎰 Casino · mesa n.º {bet.id}</p>
      <p className="mt-1 font-display text-lg font-black leading-tight">{bet.title}</p>
      <p className="mt-1 text-sm">
        {bet.pot} ☕ no pote · {bet.bettors} {bet.bettors === 1 ? "apostador" : "apostadores"} · fecha {formatSchedule(bet.closes_at)}
      </p>
    </Link>
  );
}
