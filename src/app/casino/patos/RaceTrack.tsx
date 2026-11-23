"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { DUCKS, positionAt, racePlan } from "@/lib/ducks-table";

const SECONDS_PER_UNIT = 0.6;

export function RaceTrack({ seed, winner }: { seed: string; winner: number }) {
  const plans = useMemo(() => racePlan(seed, winner), [seed, winner]);
  const finish = Math.max(...plans.map((p) => p.total));
  const [elapsed, setElapsed] = useState(finish);
  const [playing, setPlaying] = useState(false);
  const frame = useRef<number | null>(null);

  useEffect(() => () => {
    if (frame.current) cancelAnimationFrame(frame.current);
  }, []);

  function play() {
    if (frame.current) cancelAnimationFrame(frame.current);
    const start = performance.now();
    setPlaying(true);
    const tick = (now: number) => {
      const t = (now - start) / 1000 / SECONDS_PER_UNIT;
      setElapsed(Math.min(t, finish));
      if (t < finish) {
        frame.current = requestAnimationFrame(tick);
      } else {
        setPlaying(false);
      }
    };
    frame.current = requestAnimationFrame(tick);
  }

  const done = elapsed >= finish;
  const order = [...plans].sort((a, b) => a.total - b.total).map((p) => p.duck);

  return (
    <div className="space-y-3">
      <div className="relative overflow-hidden border-4 border-[#141414] bg-[#7ec8e3]">
        <div className="absolute inset-y-0 right-6 w-1.5 bg-[repeating-linear-gradient(#141414_0_6px,#fff_6px_12px)]" aria-hidden="true" />
        {DUCKS.map((d) => {
          const plan = plans.find((p) => p.duck === d.n)!;
          const pos = positionAt(plan, elapsed);
          const place = order.indexOf(d.n) + 1;
          return (
            <div key={d.n} className="relative h-11 border-b border-dashed border-white/60 last:border-b-0">
              <span
                className="absolute top-1/2 -translate-y-1/2 text-3xl transition-none"
                style={{ left: `calc(${pos} * (100% - 4.5rem))` }}
                aria-hidden="true"
              >
                <span className="inline-block -scale-x-100">🦆</span>
              </span>
              <span
                className="absolute left-1 top-0.5 rounded px-1 text-[10px] font-black text-white"
                style={{ backgroundColor: d.color }}
              >
                {d.n}
              </span>
              {done && place <= 3 && (
                <span className="absolute left-7 top-1/2 -translate-y-1/2 text-base">
                  {place === 1 ? "🥇" : place === 2 ? "🥈" : "🥉"}
                </span>
              )}
            </div>
          );
        })}
      </div>
      <button
        type="button"
        onClick={play}
        disabled={playing}
        className="w-full border-2 border-[#141414] bg-[#fff6d6] py-2 text-sm font-black uppercase text-[#141414] disabled:opacity-60"
      >
        {playing ? "Quá quá quá…" : "▶ Ver a corrida"}
      </button>
    </div>
  );
}
