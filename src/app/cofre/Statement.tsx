import Link from "next/link";
import type { MovementKind, StatementLine } from "@/lib/history";

const ICON: Record<MovementKind, string> = {
  post: "📝",
  comment: "💬",
  laugh: "😂",
  rota: "✍️",
  rota_fine: "🚫",
  fee: "🧾",
  bonus: "🎁",
  ledger: "📒",
};

const MAX_LINES = 300;

const day = new Intl.DateTimeFormat("pt-PT", { timeZone: "Europe/Lisbon", day: "2-digit", month: "2-digit", year: "2-digit" });
const time = new Intl.DateTimeFormat("pt-PT", { timeZone: "Europe/Lisbon", hour: "2-digit", minute: "2-digit" });

function signed(n: number): string {
  return n > 0 ? `+${n}` : String(n);
}

export function Statement({ lines, empty }: { lines: StatementLine[]; empty: string }) {
  if (lines.length === 0) return <p className="mt-2 text-muted">{empty}</p>;
  const shown = lines.slice(0, MAX_LINES);
  return (
    <>
      <ul className="divide-y divide-rule border-y-2 border-ink">
        {shown.map((l, i) => {
          const label = (
            <>
              <span className="mr-1" aria-hidden="true">{ICON[l.kind]}</span>
              {l.label}
            </>
          );
          return (
            <li key={i} className="flex items-baseline gap-3 py-2 text-sm">
              <span className="w-16 shrink-0 text-xs leading-tight text-muted">
                {day.format(l.at)}
                <span className="block">{time.format(l.at)}</span>
              </span>
              <span className="min-w-0 flex-1 break-words">
                {l.href ? <Link href={l.href} className="hover:text-scoop hover:underline">{label}</Link> : label}
              </span>
              <span className={`w-14 shrink-0 text-right font-bold ${l.amount < 0 ? "text-scoop" : ""}`}>{signed(l.amount)}</span>
              <span className="w-14 shrink-0 text-right font-display font-black">{l.balance}</span>
            </li>
          );
        })}
      </ul>
      {lines.length > MAX_LINES && (
        <p className="mt-2 text-xs text-muted">A mostrar os {MAX_LINES} movimentos mais recentes de {lines.length}.</p>
      )}
    </>
  );
}

export function StatementHeader() {
  return (
    <div className="flex gap-3 pb-1 text-[11px] font-bold uppercase tracking-wider text-muted">
      <span className="w-16 shrink-0">Data</span>
      <span className="flex-1">Movimento</span>
      <span className="w-14 shrink-0 text-right">Valor</span>
      <span className="w-14 shrink-0 text-right">Saldo</span>
    </div>
  );
}
