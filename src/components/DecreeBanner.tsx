import Link from "next/link";
import type { Decree } from "@/lib/decrees";

export function DecreeBanner({ decree }: { decree: Decree | null }) {
  if (!decree) return null;
  return (
    <aside className="border-4 border-double border-ink bg-white p-4">
      <p className="text-xs font-black uppercase tracking-widest text-scoop">
        👑 Decreto Presidencial n.º {decree.number}/{decree.year}
      </p>
      <p className="mt-1 font-display text-2xl font-black leading-tight">{decree.title}</p>
      <p className="mt-1 line-clamp-3 whitespace-pre-wrap text-sm">{decree.body}</p>
      <p className="mt-2 text-xs text-muted">
        Assinado: {decree.author} ·{" "}
        <Link href="/decretos" className="underline hover:text-scoop">Arquivo de decretos</Link>
      </p>
    </aside>
  );
}

export function PresidentShortcut() {
  return (
    <Link
      href="/decretos#gabinete"
      className="inline-block border-2 border-ink bg-flash px-4 py-2 font-bold uppercase tracking-wider hover:bg-ink hover:text-white"
    >
      👑 Novo decreto
    </Link>
  );
}
