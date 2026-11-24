import Link from "next/link";
import type { Highlight } from "@/lib/posts";
import { formatDateTime } from "@/lib/dates";

export function HighlightBox({ highlights }: { highlights: Highlight[] }) {
  if (highlights.length === 0) return null;
  return (
    <section className="border-4 border-double border-ink bg-flash p-4">
      <p className="text-xs font-black uppercase tracking-widest">📌 Em destaque (pago)</p>
      <ul className="mt-2 space-y-1">
        {highlights.map((h) => (
          <li key={h.id}>
            <Link href={`/post/${h.id}`} className="font-display text-2xl font-black hover:text-scoop">{h.title}</Link>
            <span className="block text-xs">por {h.author} · até {formatDateTime(h.until)}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}
