import type { ReactNode } from "react";
import { MODULES, getClosedModules, type CasinoGame } from "@/lib/modules";

const HAZARD = "bg-[repeating-linear-gradient(-45deg,#fff_0_14px,#e10600_14px_28px)]";

export async function GameGate({ game, children }: { game: CasinoGame; children: ReactNode }) {
  const closed = (await getClosedModules()).has(game);
  if (!closed) return children;
  return (
    <>
      <div role="status" className={`-mx-4 mb-4 p-2 sm:mx-0 ${HAZARD}`}>
        <p className="mx-auto max-w-md border-2 border-[#141414] bg-white px-3 py-2 text-center text-sm font-bold text-[#141414]">
          🔒 {MODULES[game].closed} Não se começam jogos novos; o que já está a decorrer termina normalmente.
        </p>
      </div>
      <div className="grayscale">{children}</div>
    </>
  );
}
