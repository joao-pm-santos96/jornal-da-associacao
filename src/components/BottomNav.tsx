"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { logout } from "@/app/actions";
import { isActive, type NavEntry, type NavSection } from "@/lib/nav";
import { unreadLabel, useUnread } from "./UnreadBadge";

const TAB = "flex flex-1 flex-col items-center gap-0.5 py-1.5 text-[11px] font-bold uppercase tracking-wide";

function Tab({ href, label, icon, active, badge, ariaLabel }: {
  href: string;
  label: string;
  icon: string;
  active: boolean;
  badge?: number;
  ariaLabel?: string;
}) {
  return (
    <Link href={href} aria-current={active ? "page" : undefined} aria-label={ariaLabel} className={`${TAB} ${active ? "text-scoop" : "text-ink"}`}>
      <span className="relative text-xl leading-none" aria-hidden="true">
        {icon}
        {badge !== undefined && badge > 0 && (
          <span className="absolute -right-3 -top-1.5 min-w-4 rounded-full bg-scoop px-1 text-center font-sans text-[10px] font-black leading-4 text-white">
            {badge}
          </span>
        )}
      </span>
      {label}
    </Link>
  );
}

function IndexSheet({ sections, isAdmin, onClose }: { sections: NavSection[]; isAdmin: boolean; onClose: () => void }) {
  const pathname = usePathname();
  let page = 0;
  const row = (e: NavEntry) => {
    page++;
    return (
      <li key={e.href}>
        <Link
          href={e.href}
          onClick={onClose}
          className={`flex items-baseline gap-2 border-b border-dotted border-ink/40 py-2.5 text-lg ${
            isActive(pathname, e.href) ? "font-black text-scoop" : "font-semibold"
          }`}
        >
          <span className="flex-1">{e.label}</span>
          <span className="font-display text-sm text-muted">pág. {page}</span>
        </Link>
      </li>
    );
  };
  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-paper md:hidden" role="dialog" aria-modal="true" aria-label="Índice">
      <div className="flex items-center justify-between bg-scoop px-4 py-3 text-white">
        <span className="font-display text-2xl font-black">Índice</span>
        <button onClick={onClose} className="px-2 text-2xl font-black leading-none" aria-label="Fechar índice">
          ✕
        </button>
      </div>
      <div className="flex-1 overflow-y-auto px-5 pb-8 pt-4">
        <p className="font-display text-xl font-black italic">Neste número</p>
        {sections.map((s) => (
          <section key={s.title} className="mt-5">
            <h2 className="border-b-2 border-ink pb-1 text-xs font-black uppercase tracking-widest text-scoop">{s.title}</h2>
            <ul>{s.entries.map(row)}</ul>
          </section>
        ))}
        <section className="mt-5">
          <h2 className="border-b-2 border-ink pb-1 text-xs font-black uppercase tracking-widest text-scoop">O sócio</h2>
          <ul>
            {row({ href: "/conta", label: "A minha conta" })}
            {isAdmin && row({ href: "/admin", label: "Admin" })}
            <li>
              <form action={logout}>
                <button className="w-full py-2.5 text-left text-lg font-semibold text-muted">Sair</button>
              </form>
            </li>
          </ul>
        </section>
      </div>
    </div>
  );
}

export function BottomNav({ sections, balance, isAdmin }: { sections: NavSection[]; balance: number; isAdmin: boolean }) {
  const pathname = usePathname();
  const unread = useUnread();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open]);

  return (
    <>
      {open && <IndexSheet sections={sections} isAdmin={isAdmin} onClose={() => setOpen(false)} />}
      <nav
        className="fixed inset-x-0 bottom-0 z-40 flex border-t-4 border-ink bg-paper pb-[env(safe-area-inset-bottom)] md:hidden"
        aria-label="Navegação principal"
      >
        <Tab href="/" label="Início" icon="📰" active={isActive(pathname, "/")} />
        <Tab href="/novo" label="Escrever" icon="✍️" active={isActive(pathname, "/novo")} />
        <Tab
          href="/novidades"
          label="Novidades"
          icon="🔔"
          badge={unread}
          ariaLabel={unreadLabel(unread)}
          active={isActive(pathname, "/novidades")}
        />
        <Tab href="/cofre" label={`${balance}`} icon="☕" ariaLabel={`Cofre: ${balance} grãos`} active={isActive(pathname, "/cofre")} />
        <button onClick={() => setOpen(true)} aria-expanded={open} className={`${TAB} text-ink`}>
          <span className="text-xl leading-none" aria-hidden="true">☰</span>
          Mais
        </button>
      </nav>
    </>
  );
}
