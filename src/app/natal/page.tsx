import { requireUser } from "@/lib/auth";
import { getNow, getSeason, lisbon } from "@/lib/seasons";
import { formatDateTime } from "@/lib/dates";
import { adventDay, ensureSantaDraw, getAdventDoors, getSanta, santaRevealed } from "@/lib/festas/natal";
import { openAdventDoor } from "@/app/festas-actions";
import { SantaCardForm } from "./SantaCardForm";

const KIND_LABEL = { tremocos: "🫘 Prémio", manchete: "📰 Manchete", profecia: "🔮 Profecia", piada: "🤭 Piada" };

function countdown(now: Date, year: number): string {
  const today = new Date(`${lisbon(now).date}T00:00:00Z`).getTime();
  const days = Math.round((new Date(`${year}-12-24T00:00:00Z`).getTime() - today) / (24 * 3600 * 1000));
  if (days < 0) return "A consoada já passou. Bom apetite!";
  if (days === 0) return "É hoje! Bacalhau na mesa às 20h00.";
  return days === 1 ? "Falta 1 dia para a consoada" : `Faltam ${days} dias para a consoada`;
}

export default async function ChristmasPage() {
  const user = await requireUser();
  const [now, season] = await Promise.all([getNow(), getSeason()]);
  const t = lisbon(now);
  const year = t.month === 12 ? t.year : t.year - 1;
  const isChristmas = season === "natal";
  if (isChristmas) await ensureSantaDraw(year);
  const revealed = santaRevealed(year, now);
  const [santa, doors] = await Promise.all([getSanta(year, user.id, revealed), getAdventDoors(year, user.id)]);
  const today = isChristmas ? adventDay(now) : null;
  const opened = new Map(doors.map((d) => [d.door, d]));

  return (
    <div className="space-y-10">
      <header>
        <h1 className="font-display text-4xl font-black sm:text-5xl">🎄 Natal na Associação</h1>
        <p className="text-muted">
          {isChristmas ? countdown(now, year) : `Arquivo do Natal de ${year}. A magia volta em dezembro.`}
        </p>
      </header>

      <section className="border-2 border-ink bg-white p-4">
        <h2 className="font-display text-2xl font-black">🎅 Amigo Secreto {year}</h2>
        {!santa.receiver ? (
          <p className="mt-2 text-muted">
            {isChristmas ? "Chegaste depois do sorteio. Para o ano há mais." : "Não houve sorteio contigo este ano."}
          </p>
        ) : (
          <>
            <p className="mt-2 text-lg">
              O teu amigo secreto é <strong>{santa.receiver.name}</strong>. Shhh… 🤫
            </p>
            {isChristmas && !revealed && (
              <div className="mt-4">
                <SantaCardForm to={santa.receiver.name} />
              </div>
            )}
          </>
        )}
        <p className="mt-4 text-sm text-muted">
          {revealed
            ? "O segredo foi revelado na consoada."
            : "A revelação é na consoada, a 24 de dezembro às 20h00 (hora de Ílhavo)."}
        </p>

        <div className="mt-6 grid gap-6 sm:grid-cols-2">
          <div>
            <h3 className="font-display text-lg font-black">📬 Postais recebidos</h3>
            {santa.received.length === 0 && <p className="text-sm text-muted">Ainda nada no sapatinho.</p>}
            <ul className="mt-2 space-y-2">
              {santa.received.map((c) => (
                <li key={c.id} className="border-l-4 border-scoop bg-paper p-2 text-sm">
                  <p className="whitespace-pre-wrap">{c.body}</p>
                  <p className="mt-1 text-xs text-muted">
                    De: {revealed ? c.from_name : "🎅 ???"} · {formatDateTime(c.created_at)}
                  </p>
                </li>
              ))}
            </ul>
          </div>
          <div>
            <h3 className="font-display text-lg font-black">✉️ Postais enviados</h3>
            {santa.sent.length === 0 && <p className="text-sm text-muted">Ainda não escreveste nenhum.</p>}
            <ul className="mt-2 space-y-2">
              {santa.sent.map((c) => (
                <li key={c.id} className="border-l-4 border-rule bg-paper p-2 text-sm">
                  <p className="whitespace-pre-wrap">{c.body}</p>
                  <p className="mt-1 text-xs text-muted">Para: {c.to_name} · {formatDateTime(c.created_at)}</p>
                </li>
              ))}
            </ul>
          </div>
        </div>

        {revealed && santa.pairs.length > 0 && (
          <div className="mt-6 border-t-2 border-ink pt-4">
            <h3 className="font-display text-2xl font-black text-scoop">REVELADO: quem era quem</h3>
            <ul className="mt-2 grid gap-1 sm:grid-cols-2">
              {santa.pairs.map((p) => (
                <li key={p.giver}>
                  <strong>{p.giver}</strong> → {p.receiver}
                </li>
              ))}
            </ul>
          </div>
        )}
      </section>

      <section>
        <h2 className="border-b-2 border-ink pb-1 font-display text-2xl font-black">📅 Calendário do Advento</h2>
        <p className="mt-1 text-sm text-muted">Uma porta por dia, só no próprio dia. Porta que não abres, porta que se perde.</p>
        <div className="mt-4 grid grid-cols-3 gap-2 sm:grid-cols-6">
          {Array.from({ length: 24 }, (_, i) => i + 1).map((door) => {
            const content = opened.get(door);
            if (content) {
              return (
                <div key={door} className="min-h-28 border-2 border-ink bg-flash p-2 text-xs">
                  <p className="font-black">{door} · {KIND_LABEL[content.kind]}</p>
                  <p className="mt-1">{content.payload}</p>
                </div>
              );
            }
            if (door === today) {
              return (
                <form key={door} action={openAdventDoor.bind(null, door)}>
                  <button className="flex min-h-28 w-full flex-col items-center justify-center border-2 border-ink bg-scoop p-2 font-display text-3xl font-black text-white hover:bg-ink">
                    {door}
                    <span className="font-sans text-xs uppercase">Abrir</span>
                  </button>
                </form>
              );
            }
            const missed = today !== null ? door < today : isChristmas;
            return (
              <div key={door}
                className={`flex min-h-28 flex-col items-center justify-center border-2 border-rule p-2 font-display text-2xl font-black ${missed ? "text-rule line-through" : "text-muted"}`}>
                {door}
                <span className="font-sans text-[10px] uppercase no-underline">{missed ? "perdida" : "🔒"}</span>
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}
