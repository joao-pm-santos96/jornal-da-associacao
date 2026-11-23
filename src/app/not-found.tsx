import Link from "next/link";
import { connection } from "next/server";
import { sql } from "@/lib/db";

const EXCUSES = [
  "Esta notícia foi censurada pela direção.",
  "{nome} garante que esta página existe. A redação continua a investigar.",
  "Página apreendida pela ASAE por excesso de cafeína.",
  "O jornalista responsável foi visto pela última vez a caminho da tasca.",
  "Esta página só vai ser publicada em 2031. Volta mais tarde.",
  "{nome} levou esta página emprestada e nunca mais a devolveu.",
  "Esta página está agendada para… nunca.",
  "O estagiário apagou isto. Não temos estagiário.",
  "Esta página foi a Ílhavo comer bacalhau. Não incomodar.",
  "Fontes seguríssimas confirmam que esta página nunca existiu. Outras fontes, igualmente seguras, negam.",
];

async function pickExcuse(): Promise<string> {
  try {
    const [row] = (await sql`
      SELECT floor(random() * ${EXCUSES.length})::int AS idx,
        (SELECT name FROM users ORDER BY random() LIMIT 1) AS name
    `) as { idx: number; name: string | null }[];
    return EXCUSES[row.idx].replace("{nome}", row.name ?? "Um membro da redação");
  } catch {
    return EXCUSES[0];
  }
}

export default async function NotFound() {
  await connection();
  const text = await pickExcuse();
  return (
    <div className="py-16 text-center">
      <p className="font-display text-8xl font-black text-scoop">404</p>
      <h1 className="mx-auto mt-2 max-w-xl font-display text-3xl font-black">{text}</h1>
      <p className="mt-2 text-sm text-muted">Recarrega a página para outra desculpa oficial.</p>
      <Link href="/" className="mt-6 inline-block font-semibold underline hover:text-scoop">Voltar à primeira página</Link>
    </div>
  );
}
