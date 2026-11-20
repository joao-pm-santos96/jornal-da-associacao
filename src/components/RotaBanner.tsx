import Link from "next/link";
import type { RotaSlot } from "@/lib/rota";
import { timeAgo } from "@/lib/dates";
import { pardonSlot } from "@/app/governo-actions";
import { ConfirmButton } from "@/components/ConfirmButton";

const weekLabel = new Intl.DateTimeFormat("pt-PT", { timeZone: "UTC", day: "numeric", month: "short" });

function week(slot: RotaSlot): string {
  const start = new Date(`${slot.week_start}T12:00:00Z`);
  const end = new Date(start.getTime() + 6 * 24 * 3600 * 1000);
  return `${weekLabel.format(start)} – ${weekLabel.format(end)}`;
}

const STATE = {
  done: { icon: "✅", label: "Cumpriu" },
  current: { icon: "📝", label: "A escrever" },
  missed: { icon: "❌", label: "EM FALTA" },
  pardoned: { icon: "🕊️", label: "Indultado" },
  upcoming: { icon: "🔜", label: "Próximo" },
};

export function RotaBanner({ rota, userId, isPresident }: { rota: RotaSlot[]; userId: number; isPresident: boolean }) {
  if (rota.length === 0) return null;
  const thisWeek = rota.find((s) => s.this_week);
  const next = rota.find((s) => s.state === "upcoming");
  const missed = rota.filter((s) => s.state === "missed");
  if (!thisWeek && !next && missed.length === 0) return null;

  return (
    <aside className="border-2 border-ink bg-white">
      <div className="bg-ink px-4 py-1 text-xs font-black uppercase tracking-widest text-white">Escala de escrita</div>
      <div className="space-y-2 p-4">
        {thisWeek?.state === "done" && (
          <p className="text-lg">
            ✅ <strong>{thisWeek.name}</strong> já cumpriu esta semana:{" "}
            <Link href={`/post/${thisWeek.post_id}`} className="font-semibold underline hover:text-scoop">
              {thisWeek.post_title}
            </Link>
          </p>
        )}
        {thisWeek && thisWeek.state !== "done" && (
          <p className="text-lg">
            📝 Esta semana escreve <strong>{thisWeek.user_id === userId ? "TU" : thisWeek.name}</strong>
            <span className="block text-sm text-muted">
              Prazo: domingo às 23:59 ({timeAgo(thisWeek.deadline)})
            </span>
          </p>
        )}
        {!thisWeek && next && (
          <p className="text-lg">
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
        <details className="text-sm">
          <summary className="cursor-pointer font-semibold underline">Ver escala completa</summary>
          <table className="mt-2 w-full text-left">
            <tbody className="divide-y divide-rule">
              {rota.map((s) => (
                <tr key={s.week_start}>
                  <td className="py-1 pr-2 whitespace-nowrap text-muted">{week(s)}</td>
                  <td className="py-1 pr-2 font-semibold">{s.name}</td>
                  <td className="py-1 whitespace-nowrap">
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
        </details>
      </div>
    </aside>
  );
}
