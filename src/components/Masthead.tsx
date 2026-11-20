"use client";

import Link from "next/link";
import { useEffect, useRef, useSyncExternalStore } from "react";

const STORAGE_KEY = "jornal:modo-ilhavo";
const CHANGE_EVENT = "jornal:modo";
const CLICKS_NEEDED = 7;
const MAX_GAP_MS = 1500;

function subscribe(onChange: () => void) {
  window.addEventListener(CHANGE_EVENT, onChange);
  return () => window.removeEventListener(CHANGE_EVENT, onChange);
}

function isIlhavo(): boolean {
  return document.documentElement.dataset.modo === "ilhavo";
}

function remember(on: boolean): void {
  try {
    if (on) localStorage.setItem(STORAGE_KEY, "1");
    else localStorage.removeItem(STORAGE_KEY);
  } catch {
    return;
  }
}

function wasRemembered(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEY) === "1";
  } catch {
    return false;
  }
}

function setIlhavo(on: boolean): void {
  if (on) document.documentElement.dataset.modo = "ilhavo";
  else delete document.documentElement.dataset.modo;
  remember(on);
  window.dispatchEvent(new Event(CHANGE_EVENT));
}

export function Masthead({ tag, carnival = false }: { tag?: string; carnival?: boolean }) {
  const ilhavo = useSyncExternalStore(subscribe, isIlhavo, () => false);
  const clicks = useRef({ count: 0, last: 0 });

  useEffect(() => {
    if (wasRemembered()) setIlhavo(true);
  }, []);

  function onClick() {
    const now = Date.now();
    const c = clicks.current;
    c.count = now - c.last < MAX_GAP_MS ? c.count + 1 : 1;
    c.last = now;
    if (c.count >= CLICKS_NEEDED) {
      c.count = 0;
      setIlhavo(!isIlhavo());
    }
  }

  return (
    <>
      <Link
        href="/"
        onClick={onClick}
        className="select-none font-display text-3xl font-black uppercase leading-none tracking-tight sm:text-6xl"
      >
        {ilhavo ? "Jornal de Ílhavo ⚓" : carnival ? "Jornal da Mascarada 🎭" : "Jornal da Associação"}
      </Link>
      {tag && !ilhavo && (
        <p className="mt-2 text-xs font-black uppercase tracking-widest text-flash">{tag}</p>
      )}
      {ilhavo && (
        <p className="mt-2 text-xs font-semibold uppercase tracking-widest text-flash">
          Por decreto da direção, o bacalhau é declarado património da Associação
        </p>
      )}
    </>
  );
}
