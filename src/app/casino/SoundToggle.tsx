"use client";

import { useSyncExternalStore } from "react";
import { SOUND_EVENT, setSoundOn, sons, soundOn } from "@/lib/sons";

function subscribe(onChange: () => void): () => void {
  window.addEventListener(SOUND_EVENT, onChange);
  window.addEventListener("storage", onChange);
  return () => {
    window.removeEventListener(SOUND_EVENT, onChange);
    window.removeEventListener("storage", onChange);
  };
}

export function SoundToggle() {
  const on = useSyncExternalStore(subscribe, soundOn, () => true);
  return (
    <button
      type="button"
      onClick={() => {
        setSoundOn(!on);
        if (!on) sons.coin();
      }}
      aria-pressed={on}
      title={on ? "Desligar o som do Casino" : "Ligar o som do Casino"}
      className="fixed bottom-[calc(5rem+env(safe-area-inset-bottom))] right-4 z-40 flex h-11 w-11 items-center justify-center rounded-full border-2 border-[#141414] bg-[#f2c230] text-xl shadow-[3px_3px_0_#141414] md:bottom-4"
    >
      <span aria-hidden="true">{on ? "🔊" : "🔇"}</span>
      <span className="sr-only">{on ? "Som ligado" : "Som desligado"}</span>
    </button>
  );
}
