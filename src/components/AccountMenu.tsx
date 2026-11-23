"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { logout } from "@/app/actions";

export function AccountMenu({ isAdmin }: { isAdmin: boolean }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const pathname = usePathname();
  const [lastPath, setLastPath] = useState(pathname);
  if (pathname !== lastPath) {
    setLastPath(pathname);
    setOpen(false);
  }

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => ref.current && !ref.current.contains(e.target as Node) && setOpen(false);
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const item = "block px-4 py-2 text-left hover:bg-flash";
  return (
    <div ref={ref} className="relative">
      <button onClick={() => setOpen((o) => !o)} aria-expanded={open} className="uppercase hover:text-scoop">
        Conta ▾
      </button>
      {open && (
        <div className="absolute right-0 top-full z-30 mt-2 min-w-40 border-2 border-ink bg-white py-1 normal-case tracking-normal">
          <Link href="/conta" className={item}>A minha conta</Link>
          {isAdmin && <Link href="/admin" className={item}>Admin</Link>}
          <form action={logout}>
            <button className={`${item} w-full`}>Sair</button>
          </form>
        </div>
      )}
    </div>
  );
}
