import Link from "next/link";
import type { AssemblySummary } from "@/lib/assembly";

export function PendingAssemblies({ pending }: { pending: AssemblySummary[] }) {
  return (
    <aside className="border-2 border-ink bg-white p-3">
      <p className="text-xs font-black uppercase tracking-widest text-scoop">📌 Por cumprir pelo governo</p>
      <ul className="mt-1 space-y-1 text-sm">
        {pending.map((a) => (
          <li key={a.id}>
            <Link href={`/assembleia/${a.id}`} className="font-bold underline hover:text-scoop">{a.title}</Link>
            {a.winner && <span> · venceu «{a.winner}»</span>}
          </li>
        ))}
      </ul>
    </aside>
  );
}
