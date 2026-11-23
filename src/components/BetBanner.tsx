import Link from "next/link";
import type { BetSummary } from "@/lib/bets";
import { formatSchedule } from "@/lib/dates";

export function BetBanner({ bet }: { bet: BetSummary | null }) {
  if (!bet) return null;
  return (
    <Link href={`/apostas/${bet.id}`} className="block border-2 border-ink bg-flash p-4 hover:bg-ink hover:text-white">
      <p className="text-xs font-black uppercase tracking-widest">🎲 Aposta da semana · n.º {bet.id}</p>
      <p className="mt-1 font-display text-2xl font-black leading-tight">{bet.title}</p>
      <p className="mt-1 text-sm">
        {bet.pot} ☕ no pote · {bet.bettors} {bet.bettors === 1 ? "apostador" : "apostadores"} · fecha {formatSchedule(bet.closes_at)}
      </p>
    </Link>
  );
}
