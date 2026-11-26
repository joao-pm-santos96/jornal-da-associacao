import Link from "next/link";
import { decreeKind, type Decree } from "@/lib/decrees";

export function DecreeBanner({ decree }: { decree: Decree | null }) {
  if (!decree) return null;
  return (
    <aside className="border-4 border-double border-ink bg-white p-3">
      <p className="text-xs font-black uppercase tracking-widest text-scoop">
        {decreeKind(decree.office)} n.º {decree.number}/{decree.year}
      </p>
      <p className="mt-1 font-display text-lg font-black leading-tight">{decree.title}</p>
      <p className="mt-1 line-clamp-2 whitespace-pre-wrap text-sm">{decree.body}</p>
      <p className="mt-2 text-xs text-muted">
        Assinado: {decree.author} ·{" "}
        <Link href="/decretos" className="underline hover:text-scoop">Arquivo de decretos</Link>
      </p>
    </aside>
  );
}
