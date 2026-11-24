import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { GRAOS, shortDate } from "@/lib/economy";
import { formatDateTime } from "@/lib/dates";
import { holds } from "@/lib/offices";
import { getNow } from "@/lib/seasons";
import { slushState } from "@/lib/slush";
import { DenounceButton, LaunderForm } from "../RepresentationForms";

const KIND: Record<string, string> = {
  desvio: "Desvio",
  lavagem: "Lavagem",
  prescricao: "Prescrição",
  confisco: "Confiscado",
  recompensa: "Prémio de delação",
};

export default async function SlushPage() {
  const user = await requireUser();
  const now = await getNow();
  const [state, treasurer, president] = await Promise.all([
    slushState(user.id, now),
    holds("tesoureiro", user.id),
    holds("presidente", user.id),
  ]);
  if (state.history.length === 0 && !treasurer && !president) notFound();
  const left = Math.max(0, Math.min(GRAOS.slushWashCap - state.washed, state.balance));

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <p className="text-sm">
        <Link href="/cofre" className="underline hover:text-scoop">← Cofre</Link>
      </p>
      <header className="border-b-4 border-dashed border-ink pb-3">
        <p className="text-xs font-black uppercase tracking-widest text-scoop">Confidencial · só tu vês esta página</p>
        <h1 className="font-display text-4xl font-black">O teu saco azul</h1>
        <p className="font-display text-6xl font-black">{state.balance} ☕</p>
      </header>

      <section className="border-2 border-ink bg-white p-4 text-sm">
        <dl className="divide-y divide-rule">
          <div className="flex justify-between py-1.5">
            <dt>Lavado esta semana</dt>
            <dd className="font-bold">{state.washed} / {GRAOS.slushWashCap} ☕</dd>
          </div>
          <div className="flex justify-between py-1.5">
            <dt>Prescreve</dt>
            <dd className="font-bold">
              {state.prescribesOn ? `a partir de ${shortDate(state.prescribesOn)}` : state.balance > 0 ? "já está limpo" : "nada por prescrever"}
            </dd>
          </div>
          <div className="flex justify-between py-1.5">
            <dt>Risco numa auditoria</dt>
            <dd className={`font-bold ${state.risk >= 60 ? "text-scoop" : ""}`}>
              {state.immune ? "imune esta semana" : `${state.risk}%`}
            </dd>
          </div>
        </dl>
        <p className="mt-2 text-xs text-muted">
          O risco sobe {GRAOS.auditPerGrainPct}% por cada grão no saco (mínimo {GRAOS.auditBasePct}%, máximo {GRAOS.auditMaxPct}%). Se fores
          apanhado, o saco volta ao Cofre e pagas {GRAOS.slushFinePct}% dele de multa. Ao fim de {GRAOS.slushPrescribeWeeks} semanas, o que
          sobrar passa sozinho para a tua carteira.
        </p>
      </section>

      {state.balance > 0 && (
        <section className="space-y-2 border-2 border-ink bg-white p-4">
          <h2 className="font-display text-2xl font-black">🧼 Lavandaria</h2>
          <p className="text-sm text-muted">
            Até {GRAOS.slushWashCap} ☕ por semana para a tua carteira. No teu extrato aparecem como «Consultoria».
          </p>
          <LaunderForm left={left} />
        </section>
      )}

      {state.balance > 0 && (
        <section className="space-y-2 border-2 border-scoop bg-white p-4">
          <h2 className="font-display text-2xl font-black">🐀 Delação premiada</h2>
          <p className="text-sm text-muted">
            Se o colega de governo também tiver um saco azul, a denúncia apanha-o sempre: ficas com metade, discretamente, e esta semana as
            auditorias não te tocam. Se não tiver, não acontece nada. Uma vez por semana.
          </p>
          <DenounceButton done={state.denounced} />
        </section>
      )}

      <section>
        <h2 className="border-b-2 border-ink pb-1 font-display text-2xl font-black">Movimentos</h2>
        {state.history.length === 0 ? (
          <p className="mt-2 text-sm text-muted">
            Ainda limpo. As despesas de representação justificam-se no teu gabinete, no Cofre.
          </p>
        ) : (
          <ul className="divide-y divide-rule">
            {state.history.map((h) => (
              <li key={h.id} className="flex items-baseline justify-between gap-2 py-2 text-sm">
                <span>
                  <strong>{KIND[h.kind] ?? h.kind}</strong> · {h.reason}
                  <span className="block text-xs text-muted">{formatDateTime(h.created_at)}</span>
                </span>
                <span className={`font-display text-lg font-black ${h.amount < 0 ? "text-scoop" : ""}`}>
                  {h.amount > 0 ? `+${h.amount}` : h.amount} ☕
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
