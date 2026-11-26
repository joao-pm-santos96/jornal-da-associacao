import Link from "next/link";
import type { AssemblySummary } from "@/lib/assembly";
import type { RotaSlot } from "@/lib/rota";
import { formatSchedule, timeAgo } from "@/lib/dates";

export function ForYouBox({ votes, turn, unread, isPresident, comedy }: {
  votes: AssemblySummary[];
  turn: RotaSlot | undefined;
  unread: number;
  isPresident: boolean;
  comedy: Date | null;
}) {
  if (votes.length === 0 && !turn && unread === 0 && !isPresident && !comedy) return null;
  return (
    <aside className="border-2 border-ink bg-flash p-4">
      <h2 className="font-display text-xl font-black">Para ti</h2>
      <ul className="mt-2 space-y-2">
        {votes.map((a) => (
          <li key={a.id}>
            🗳️ A Assembleia espera o teu voto:{" "}
            <Link href={`/assembleia/${a.id}`} className="font-bold underline hover:text-scoop">{a.title}</Link>
            <span className="text-sm"> · fecha {formatSchedule(a.closes_at)}</span>
          </li>
        ))}
        {comedy && (
          <li>
            🎤 A votação do Comedy Club está aberta até {formatSchedule(comedy)} ·{" "}
            <Link href="/comedy-club" className="font-bold underline hover:text-scoop">Votar na melhor piada</Link>
          </li>
        )}
        {turn && (
          <li>
            📝 Esta semana escreves <strong>TU</strong>, prazo domingo às 23:59 ({timeAgo(turn.deadline)}) ·{" "}
            <Link href="/novo" className="font-bold underline hover:text-scoop">Escrever</Link>
          </li>
        )}
        {unread > 0 && (
          <li>
            📬{" "}
            <Link href="/novidades" className="font-bold underline hover:text-scoop">
              {unread === 1 ? "1 post com novidades por ler" : `${unread} posts com novidades por ler`}
            </Link>
          </li>
        )}
        {isPresident && (
          <li>
            👑{" "}
            <Link href="/decretos#gabinete" className="font-bold underline hover:text-scoop">Assinar um novo decreto</Link>
          </li>
        )}
      </ul>
    </aside>
  );
}
