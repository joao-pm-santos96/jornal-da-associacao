import type { ReactNode } from "react";
import { MODULES, isOpen } from "@/lib/modules";
import { SoundToggle } from "./SoundToggle";

export default async function CasinoLayout({ children }: { children: ReactNode }) {
  const open = await isOpen("casino");
  return (
    <>
      {!open && (
        <p className="mb-6 border-4 border-scoop bg-white p-3 text-center font-bold text-scoop">
          🔒 {MODULES.casino.closed} Não se aceitam apostas novas; o que já está em jogo resolve-se normalmente.
        </p>
      )}
      {children}
      <SoundToggle />
    </>
  );
}
