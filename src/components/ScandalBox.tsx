import type { Scandal } from "@/lib/slush";
import { formatDateTime } from "@/lib/dates";

export function ScandalBox({ scandals }: { scandals: Scandal[] }) {
  if (scandals.length === 0) return null;
  return (
    <section className="border-4 border-scoop bg-white p-4">
      <p className="text-xs font-black uppercase tracking-widest text-scoop">🚨 Escândalo</p>
      <ul className="mt-2 space-y-3">
        {scandals.map((s) => (
          <li key={s.id}>
            <p className="font-display text-3xl font-black leading-tight">
              {s.name} apanhado com {s.recovered} ☕ no saco azul
            </p>
            <p className="text-sm">
              {s.source === "denuncia" ? "Graças a uma denúncia anónima" : "Uma auditoria às contas do governo descobriu tudo"}: os grãos
              voltaram ao Cofre{s.fine > 0 ? ` e o arguido paga ${s.fine} ☕ de multa` : ""}.
              <span className="block text-xs text-muted">{formatDateTime(s.created_at)}</span>
            </p>
          </li>
        ))}
      </ul>
    </section>
  );
}
