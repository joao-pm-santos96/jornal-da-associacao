"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { isActive, type NavSection } from "@/lib/nav";

export function SectionNav({ sections }: { sections: NavSection[] }) {
  const pathname = usePathname();
  return (
    <nav className="hidden border-t border-rule md:block" aria-label="Secções">
      <div className="mx-auto flex max-w-4xl flex-wrap items-center justify-center gap-x-10 gap-y-1 px-4 py-2 text-xs font-bold uppercase tracking-wider">
        {sections.map((s) => (
          <ul key={s.title} aria-label={s.title} className="flex items-center gap-x-4 whitespace-nowrap">
            {s.entries.map((e) => {
              const active = isActive(pathname, e.href);
              return (
                <li key={e.href}>
                  <Link
                    href={e.href}
                    aria-current={active ? "page" : undefined}
                    className={active ? "text-scoop underline decoration-2 underline-offset-4" : "hover:text-scoop"}
                  >
                    {e.label}
                  </Link>
                </li>
              );
            })}
          </ul>
        ))}
      </div>
    </nav>
  );
}
