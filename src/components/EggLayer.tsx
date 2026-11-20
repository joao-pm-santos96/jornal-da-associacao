"use client";

import { usePathname } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { collectEgg } from "@/app/festas-actions";
import type { EggSpot } from "@/lib/festas/pascoa";

export function EggLayer() {
  const pathname = usePathname();
  const [eggs, setEggs] = useState<EggSpot[]>([]);
  const [toast, setToast] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/ovos?path=${encodeURIComponent(pathname)}`, { cache: "no-store" })
      .then((res) => (res.ok ? res.json() : { eggs: [] }))
      .then((data: { eggs: EggSpot[] }) => {
        if (!cancelled) setEggs(data.eggs);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [pathname]);

  function grab(egg: number) {
    startTransition(async () => {
      const { found } = await collectEgg(egg);
      setEggs((list) => list.filter((e) => e.egg !== egg));
      setToast(found ? `🥚 Ovo n.º ${egg} apanhado! +1 🫘` : "Este ovo já era teu.");
      setTimeout(() => setToast(null), 3500);
    });
  }

  return (
    <>
      {eggs.map((s) => (
        <button
          key={s.egg}
          type="button"
          disabled={pending}
          onClick={() => grab(s.egg)}
          aria-label="Um ovo da Páscoa escondido"
          className="absolute z-40 select-none text-xl opacity-80 transition hover:scale-150 hover:opacity-100"
          style={{ top: `${s.top}%`, left: `${s.left}%` }}
        >
          🥚
        </button>
      ))}
      {toast && (
        <p role="status" className="fixed bottom-6 left-1/2 z-50 -translate-x-1/2 border-2 border-ink bg-flash px-4 py-2 font-bold shadow-lg">
          {toast}
        </p>
      )}
    </>
  );
}
