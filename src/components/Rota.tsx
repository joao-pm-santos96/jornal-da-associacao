import Link from "next/link";
import type { RotaSlot } from "@/lib/rota";
import { timeAgo } from "@/lib/dates";
import { pardonSlot } from "@/app/governo-actions";
import { ConfirmButton } from "@/components/ConfirmButton";

const dayLabel = new Intl.DateTimeFormat("pt-PT", { timeZone: "UTC", day: "numeric" });
const monthLabel = new Intl.DateTimeFormat("pt-PT", { timeZone: "UTC", month: "short" });

function week(slot: RotaSlot): string {
  const start = new Date(`${slot.week_start}T12:00:00Z`);
  const end = new Date(start.getTime() + 6 * 24 * 3600 * 1000);
  const [d1, m1, d2, m2] = [dayLabel.format(start), monthLabel.format(start), dayLabel.format(end), monthLabel.format(end)];
  return m1 === m2 ? `${d1}–${d2} ${m2}` : `${d1} ${m1} – ${d2} ${m2}`;
}

const STATE = {
  done: { icon: "✅", label: "Cumpriu" },
  current: { icon: "📝", label: "A escrever" },
  missed: { icon: "❌", label: "EM FALTA" },
  pardoned: { icon: "🕊️", label: "Indultado" },
  upcoming: { icon: "🔜", label: "Próximo" },
};

export type RotaSummary = { thisWeek: RotaSlot | undefined; next: RotaSlot | undefined; missed: RotaSlot[] };

export function summarizeRota(rota: RotaSlot[]): RotaSummary | null {
  const thisWeek = rota.find((s) => s.this_week);
  const next = rota.find((s) => s.state === "upcoming");
  const missed = rota.filter((s) => s.state === "missed");
  return thisWeek || next || missed.length > 0 ? { thisWeek, next, missed } : null;
}

export function myTurn(rota: RotaSlot[], userId: number): RotaSlot | undefined {
  return rota.find((s) => s.this_week && s.state === "current" && s.user_id === userId);
}

export function RotaStatus({ summary, userId }: { summary: RotaSummary; userId: number }) {
  const { thisWeek, next, missed } = summary;
  return (
    <div className="space-y-2">
      {thisWeek?.state === "done" && (
        <p>
          ✅ <strong>{thisWeek.name}</strong> já cumpriu esta semana:{" "}
          <Link href={`/post/${thisWeek.post_id}`} className="font-semibold underline hover:text-scoop">
            {thisWeek.post_title}
          </Link>
        </p>
      )}
      {thisWeek && thisWeek.state !== "done" && (
        <p>
          📝 Esta semana escreve <strong>{thisWeek.user_id === userId ? "TU" : thisWeek.name}</strong>
          <span className="block text-sm text-muted">Prazo: domingo às 23:59 ({timeAgo(thisWeek.deadline)})</span>
        </p>
      )}
      {!thisWeek && next && (
        <p>
          📅 A seguir escreve <strong>{next.user_id === userId ? "TU" : next.name}</strong>
          <span className="block text-sm text-muted">Semana de {week(next)}</span>
        </p>
      )}
      {missed.length > 0 && (
        <p className="text-sm">
          <span className="mr-1 inline-block -rotate-2 bg-scoop px-1.5 py-0.5 text-xs font-black uppercase text-white">
            Em falta
          </span>
          {missed.map((s) => s.name).join(", ")}
        </p>
      )}
    </div>
  );
}

export function RotaBrief({ summary, userId }: { summary: RotaSummary; userId: number }) {
  return (
    <aside className="border-2 border-ink bg-white">
      <div className="bg-ink px-3 py-1 text-xs font-black uppercase tracking-widest text-white">Escala de escrita</div>
      <div className="space-y-2 p-3">
        <RotaStatus summary={summary} userId={userId} />
        <Link href="/escala" className="inline-block text-sm font-semibold underline hover:text-scoop">Ver escala completa →</Link>
      </div>
    </aside>
  );
}

export function RotaTable({ rota, isPresident }: { rota: RotaSlot[]; isPresident: boolean }) {
  return (
    <table className="w-full text-left text-sm sm:text-base">
      <tbody className="divide-y divide-rule">
        {rota.map((s) => (
          <tr key={s.week_start}>
            <td className="py-2 pr-2 whitespace-nowrap text-muted">{week(s)}</td>
            <td className="py-2 pr-2 font-semibold">{s.name}</td>
            <td className="py-2">
              {STATE[s.state].icon}{" "}
              {s.state === "missed" && isPresident ? (
                <form action={pardonSlot.bind(null, s.week_start)} className="inline">
                  <span className="font-black text-scoop">{STATE.missed.label}</span>{" "}
                  <ConfirmButton message={`Indultar ${s.name}? A multa da escala é perdoada.`} className="text-xs underline">
                    Indultar
                  </ConfirmButton>
                </form>
              ) : s.state === "done" && s.post_id ? (
                <Link href={`/post/${s.post_id}`} className="underline">{STATE.done.label}</Link>
              ) : (
                <span className={s.state === "missed" ? "font-black text-scoop" : ""}>{STATE[s.state].label}</span>
              )}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
