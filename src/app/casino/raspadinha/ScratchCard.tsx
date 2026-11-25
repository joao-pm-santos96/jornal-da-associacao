"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { winningSymbol } from "@/lib/scratch-table";
import { sons } from "@/lib/sons";
import { buyTicket, markScratched, type Ticket } from "./actions";

const REVEAL_AT = 0.55;

function paintCover(canvas: HTMLCanvasElement) {
  const dpr = window.devicePixelRatio || 1;
  const { width, height } = canvas.getBoundingClientRect();
  canvas.width = Math.round(width * dpr);
  canvas.height = Math.round(height * dpr);
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  ctx.globalCompositeOperation = "source-over";
  ctx.fillStyle = "#b9b9b9";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = "#a3a3a3";
  ctx.font = `900 ${14 * dpr}px system-ui, sans-serif`;
  ctx.textAlign = "center";
  for (let y = 22 * dpr; y < canvas.height; y += 34 * dpr) {
    for (let x = 40 * dpr; x < canvas.width; x += 90 * dpr) {
      ctx.fillText("RASPA ☕", x + ((y / (34 * dpr)) % 2) * 45 * dpr, y);
    }
  }
}

function scratchedFraction(canvas: HTMLCanvasElement): number {
  const ctx = canvas.getContext("2d");
  if (!ctx) return 1;
  const { data } = ctx.getImageData(0, 0, canvas.width, canvas.height);
  let clear = 0;
  let total = 0;
  for (let i = 3; i < data.length; i += 4 * 16) {
    total++;
    if (data[i] === 0) clear++;
  }
  return total ? clear / total : 1;
}

export function ScratchCard({ initial, price }: { initial: Ticket | null; price: number }) {
  const router = useRouter();
  const [ticket, setTicket] = useState<Ticket | null>(initial);
  const [revealed, setRevealed] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const scratching = useRef(false);
  const moves = useRef(0);

  useEffect(() => {
    if (ticket && !revealed && canvasRef.current) paintCover(canvasRef.current);
  }, [ticket, revealed]);

  function reveal() {
    if (!ticket || revealed) return;
    setRevealed(true);
    if (ticket.prize > ticket.cost) sons.win(ticket.prize / ticket.cost);
    else if (ticket.prize === ticket.cost) sons.coin();
    else sons.lose();
    markScratched(ticket.id).finally(() => router.refresh());
  }

  function scratchAt(e: React.PointerEvent<HTMLCanvasElement>) {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    ctx.globalCompositeOperation = "destination-out";
    ctx.beginPath();
    ctx.arc((e.clientX - rect.left) * dpr, (e.clientY - rect.top) * dpr, 22 * dpr, 0, Math.PI * 2);
    ctx.fill();
    moves.current++;
    if (moves.current % 3 === 1) sons.scratch();
    if (moves.current % 10 === 0 && scratchedFraction(canvas) >= REVEAL_AT) reveal();
  }

  async function buy() {
    setBusy(true);
    setError(null);
    sons.buy();
    const result = await buyTicket().catch(() => null);
    setBusy(false);
    if (!result) return setError("A máquina dos bilhetes encravou. Tenta outra vez.");
    if (!result.ok) return setError(result.error);
    moves.current = 0;
    setRevealed(false);
    setTicket(result.ticket);
    router.refresh();
  }

  const winner = ticket && revealed ? winningSymbol(ticket.cells) : null;
  const message = !ticket || !revealed
    ? null
    : ticket.prize > ticket.cost
      ? { text: `🎉 Ganhaste ${ticket.prize} ☕!`, tone: "bg-[#f2c230] text-[#141414] animate-bounce" }
      : ticket.prize === ticket.cost
        ? { text: "🫘🫘🫘 Recuperas o bilhete.", tone: "bg-white text-[#141414]" }
        : { text: "Não foi desta. O bacalhau fica para a próxima.", tone: "bg-[#141414] text-[#fff6d6]" };

  return (
    <div className="mx-auto max-w-sm space-y-4">
      <div className="-rotate-1 border-4 border-[#141414] bg-[#fff6d6] p-3 text-[#141414] shadow-[6px_6px_0_#141414]">
        <div className="flex items-baseline justify-between border-b-2 border-dashed border-[#141414] pb-1">
          <span className="font-display text-2xl font-black uppercase text-[#e10600]">Raspa o Bacalhau</span>
          <span className="text-xs font-black">{ticket?.cost ?? price} ☕</span>
        </div>
        <p className="mt-1 text-[11px] font-bold uppercase tracking-wider">Três iguais ganham · série «Ílhavo da Sorte»</p>
        {ticket ? (
          <div className="relative mt-3 select-none">
            <div className="grid grid-cols-3 gap-2">
              {ticket.cells.map((c, i) => (
                <div
                  key={i}
                  className={`flex h-20 items-center justify-center border-2 border-[#141414] text-4xl ${
                    winner === c ? "bg-[#f2c230]" : "bg-white"
                  }`}
                >
                  {c}
                </div>
              ))}
            </div>
            {!revealed && (
              <canvas
                ref={canvasRef}
                className="absolute inset-0 h-full w-full cursor-pointer touch-none"
                aria-label="Zona para raspar"
                onPointerDown={(e) => {
                  scratching.current = true;
                  e.currentTarget.setPointerCapture(e.pointerId);
                  scratchAt(e);
                }}
                onPointerMove={(e) => scratching.current && scratchAt(e)}
                onPointerUp={() => {
                  scratching.current = false;
                }}
              />
            )}
          </div>
        ) : (
          <div className="mt-3 flex h-44 items-center justify-center border-2 border-dashed border-[#141414] text-center text-sm font-bold">
            Compra um bilhete e raspa com o dedo.
          </div>
        )}
        <p className="mt-2 text-center text-[10px] uppercase tracking-widest">Válido até à próxima crise · não reembolsável</p>
      </div>

      {message && <p className={`border-2 border-[#141414] px-3 py-2 text-center font-bold ${message.tone}`}>{message.text}</p>}
      {error && <p className="border-2 border-scoop bg-white p-2 text-center text-sm font-semibold text-scoop">{error}</p>}

      <div className="flex gap-2">
        {ticket && !revealed ? (
          <button
            type="button"
            onClick={reveal}
            className="flex-1 border-2 border-[#141414] bg-[#fff6d6] py-3 text-sm font-black uppercase text-[#141414]"
          >
            Raspar tudo de uma vez
          </button>
        ) : (
          <button
            type="button"
            onClick={buy}
            disabled={busy}
            className="flex-1 border-4 border-[#f2c230] bg-[#e10600] py-3 font-display text-xl font-black uppercase text-white shadow-[4px_4px_0_#141414] active:translate-y-0.5 disabled:opacity-60"
          >
            {busy ? "A imprimir…" : `Comprar bilhete (${price} ☕)`}
          </button>
        )}
      </div>
    </div>
  );
}
