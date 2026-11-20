"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { READ_EVENT } from "./ViewTracker";

const TITLE = "Jornal da Associação";
const POLL_MS = 60_000;

export function UnreadBadge({ initial }: { initial: number }) {
  const [count, setCount] = useState(initial);
  const pathname = usePathname();

  useEffect(() => {
    let cancelled = false;
    const refresh = () => {
      if (document.visibilityState !== "visible") return;
      fetch("/api/novidades", { cache: "no-store" })
        .then((res) => (res.ok ? res.json() : null))
        .then((data: { count: number } | null) => {
          if (data && !cancelled) setCount(data.count);
        })
        .catch(() => undefined);
    };
    refresh();
    const timer = setInterval(refresh, POLL_MS);
    document.addEventListener("visibilitychange", refresh);
    window.addEventListener(READ_EVENT, refresh);
    return () => {
      window.removeEventListener(READ_EVENT, refresh);
      cancelled = true;
      clearInterval(timer);
      document.removeEventListener("visibilitychange", refresh);
    };
  }, [pathname]);

  return (
    <>
      <title>{count > 0 ? `(${count}) ${TITLE}` : TITLE}</title>
      <Link href="/#por-ler" className="hover:text-scoop" aria-label={count === 1 ? "1 novidade por ler" : `${count} novidades por ler`}>
      🔔
      {count > 0 && (
        <span className="ml-0.5 rounded-full bg-scoop px-1.5 py-0.5 text-[10px] font-black text-white">{count}</span>
      )}
      </Link>
    </>
  );
}
