"use client";

import { useState, type ReactNode } from "react";
import { markLetterRead } from "@/app/representacao-actions";

export function ConfidentialLetter({ office, unread, children }: { office: "presidente" | "tesoureiro"; unread: boolean; children: ReactNode }) {
  const [fresh, setFresh] = useState(unread);
  return (
    <details
      className="group border-2 border-dashed border-ink bg-[#f4ead5]"
      onToggle={(e) => {
        if (fresh && e.currentTarget.open) {
          setFresh(false);
          void markLetterRead(office);
        }
      }}
    >
      <summary className="flex cursor-pointer list-none items-center gap-3 p-3">
        <span className="text-3xl" aria-hidden="true">✉️</span>
        <span className="min-w-0 flex-1">
          <span className="block text-xs font-black uppercase tracking-widest text-scoop">Confidencial · só para o titular do cargo</span>
          <span className="block font-display text-lg font-black">Carta do teu antecessor</span>
        </span>
        {fresh && <span className="bg-scoop px-2 py-0.5 text-[10px] font-black uppercase text-white">Por abrir</span>}
        <span className="text-xs font-bold uppercase underline group-open:hidden">Abrir</span>
        <span className="hidden text-xs font-bold uppercase underline group-open:inline">Fechar</span>
      </summary>
      <div className="space-y-3 border-t-2 border-dashed border-ink p-4 font-serif text-[15px] leading-relaxed">{children}</div>
    </details>
  );
}
