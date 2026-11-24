"use client";

import { useState, useTransition } from "react";
import { buyHighlight, tip } from "@/app/economia-actions";

const OPTIONS = [1, 2, 5, 10];

export function TipButton({ kind, targetId }: { kind: "post" | "comment"; targetId: number }) {
  const [message, setMessage] = useState<{ text: string; error: boolean } | null>(null);
  const [pending, start] = useTransition();
  return (
    <details className="relative inline-block text-xs">
      <summary className="cursor-pointer list-none rounded-full border border-rule bg-white px-2 py-0.5 hover:border-ink">
        ☕ Pagar um café
      </summary>
      <div className="absolute z-10 mt-1 w-56 space-y-2 border-2 border-ink bg-white p-2">
        <p className="text-muted">Quantos grãos? 10% de IVA para o Cofre.</p>
        <div className="flex gap-1">
          {OPTIONS.map((n) => (
            <button
              key={n}
              type="button"
              disabled={pending}
              onClick={() =>
                start(async () => {
                  const r = await tip(kind, targetId, n);
                  setMessage(r.error ? { text: r.error, error: true } : { text: r.ok ?? "", error: false });
                })
              }
              className="flex-1 border-2 border-ink px-1 py-1 font-bold hover:bg-flash disabled:opacity-50"
            >
              {n}
            </button>
          ))}
        </div>
        {message && <p className={message.error ? "font-semibold text-scoop" : "font-semibold"}>{message.text}</p>}
      </div>
    </details>
  );
}

export function HighlightButton({ postId, price, hours }: { postId: number; price: number; hours: number }) {
  const [message, setMessage] = useState<{ text: string; error: boolean } | null>(null);
  const [pending, start] = useTransition();
  return (
    <span className="inline-flex flex-wrap items-center gap-2 text-xs">
      <button
        type="button"
        disabled={pending}
        onClick={() => {
          if (!confirm(`Destacar este post na primeira página durante ${hours} horas por ${price} ☕?`)) return;
          start(async () => {
            const r = await buyHighlight(postId);
            setMessage(r.error ? { text: r.error, error: true } : { text: r.ok ?? "", error: false });
          });
        }}
        className="rounded-full border border-rule bg-white px-2 py-0.5 hover:border-ink disabled:opacity-50"
      >
        📌 Destacar ({price} ☕)
      </button>
      {message && <span className={message.error ? "font-semibold text-scoop" : "font-semibold"}>{message.text}</span>}
    </span>
  );
}
