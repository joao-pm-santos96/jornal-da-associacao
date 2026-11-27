"use client";

import { useActionState } from "react";
import { setRaceSchedule } from "./actions";

const select = "border-2 border-ink bg-white p-1.5 text-ink";

export function RaceScheduleForm({ day, hour, days }: { day: number; hour: number; days: readonly string[] }) {
  const [state, action, pending] = useActionState(setRaceSchedule, {});
  return (
    <form action={action} className="space-y-2">
      {state.error && <p className="border-2 border-scoop bg-white p-2 text-sm font-semibold text-scoop">{state.error}</p>}
      {state.ok && <p className="border-2 border-ink bg-flash p-2 text-sm font-semibold text-ink">{state.ok}</p>}
      <div className="flex flex-wrap items-end gap-3">
        <div>
          <label htmlFor="race-day" className="block text-xs font-semibold">Dia</label>
          <select id="race-day" name="day" defaultValue={day} className={select}>
            {days.map((d, i) => <option key={d} value={i + 1}>{d.charAt(0).toUpperCase() + d.slice(1)}</option>)}
          </select>
        </div>
        <div>
          <label htmlFor="race-hour" className="block text-xs font-semibold">Hora</label>
          <select id="race-hour" name="hour" defaultValue={hour} className={select}>
            {Array.from({ length: 24 }, (_, h) => <option key={h} value={h}>{h}h</option>)}
          </select>
        </div>
        <button disabled={pending} className="bg-ink px-4 py-2 text-sm font-bold uppercase text-white disabled:opacity-50">
          👑 Decretar
        </button>
      </div>
    </form>
  );
}
