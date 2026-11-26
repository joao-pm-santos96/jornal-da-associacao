import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { getRota } from "@/lib/rota";
import { getOffices } from "@/lib/offices";
import { RotaStatus, RotaTable, summarizeRota } from "@/components/Rota";

export default async function RotaPage() {
  const user = await requireUser();
  const [rota, offices] = await Promise.all([getRota(), getOffices()]);
  const isPresident = offices.presidente?.user_id === user.id;
  const summary = summarizeRota(rota);

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <header className="border-b-4 border-ink pb-3">
        <h1 className="font-display text-4xl font-black sm:text-5xl">Escala de escrita</h1>
        <p className="text-muted">Cada semana há um sócio de serviço à redação. Quem falha o prazo de domingo paga multa.</p>
      </header>
      {rota.length === 0 ? (
        <p className="text-muted">Ainda não há escala. É o Presidente quem a marca.</p>
      ) : (
        <>
          {summary && (
            <div className="border-2 border-ink bg-white p-4 text-lg">
              <RotaStatus summary={summary} userId={user.id} />
            </div>
          )}
          <RotaTable rota={rota} isPresident={isPresident} />
        </>
      )}
      {isPresident && (
        <Link href="/decretos#gabinete" className="inline-block text-sm font-bold underline hover:text-scoop">
          👑 Marcar semanas no gabinete →
        </Link>
      )}
    </div>
  );
}
