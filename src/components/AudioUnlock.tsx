"use client";

import { useEffect } from "react";
import { sons } from "@/lib/sons";

export function AudioUnlock() {
  useEffect(() => {
    const unlock = () => sons.unlock();
    document.addEventListener("pointerdown", unlock, { once: true, capture: true });
    document.addEventListener("keydown", unlock, { once: true, capture: true });
    return () => {
      document.removeEventListener("pointerdown", unlock, { capture: true });
      document.removeEventListener("keydown", unlock, { capture: true });
    };
  }, []);
  return null;
}
