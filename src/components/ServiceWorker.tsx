"use client";

import { useEffect } from "react";

export type InstallPromptEvent = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: string }> };

export const INSTALL_EVENT = "jornal:install-available";

declare global {
  interface Window {
    jornalInstallPrompt?: InstallPromptEvent | null;
  }
}

export function ServiceWorker() {
  useEffect(() => {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js", { scope: "/", updateViaCache: "none" }).catch(() => undefined);
    }
    const onPrompt = (e: Event) => {
      e.preventDefault();
      window.jornalInstallPrompt = e as InstallPromptEvent;
      window.dispatchEvent(new Event(INSTALL_EVENT));
    };
    window.addEventListener("beforeinstallprompt", onPrompt);
    return () => window.removeEventListener("beforeinstallprompt", onPrompt);
  }, []);
  return null;
}
