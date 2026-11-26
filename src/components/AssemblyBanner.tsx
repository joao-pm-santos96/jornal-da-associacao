import Link from "next/link";
import { formatSchedule } from "@/lib/dates";
import { pendingExecution, type AssemblySummary } from "@/lib/assembly";

export function AssemblyBanner({ assemblies }: { assemblies: AssemblySummary[] }) {
  const missing = assemblies.filter((a) => a.status === "open" && !a.voted);
  const pending = assemblies.filter(pendingExecution);
  if (missing.length === 0 && pending.length === 0) return null;
  return (
    <aside className="space-y-2 border-4 border-double border-ink bg-white p-4">
      {missing.length > 0 && (
        <div>
          <p className="text-xs font-black uppercase tracking-widest text-scoop">🗳️ A Assembleia espera o teu voto</p>
          <ul className="mt-1 space-y-1">
            {missing.map((a) => (
              <li key={a.id}>
                <Link href={`/assembleia/${a.id}`} className="font-display text-xl font-black leading-tight underline hover:text-scoop">{a.title}</Link>
                <span className="text-sm"> · fecha {formatSchedule(a.closes_at)}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
      {pending.length > 0 && (
        <div>
          <p className="text-xs font-black uppercase tracking-widest text-scoop">📌 Por cumprir pelo governo</p>
          <ul className="mt-1 space-y-1 text-sm">
            {pending.map((a) => (
              <li key={a.id}>
                <Link href={`/assembleia/${a.id}`} className="font-bold underline hover:text-scoop">{a.title}</Link>
                {a.winner && <span> · venceu «{a.winner}»</span>}
              </li>
            ))}
          </ul>
        </div>
      )}
    </aside>
  );
}
