import type { ReactNode } from "react";
import { CasinoEntrance, SoundToggle } from "./SoundToggle";

export default function CasinoLayout({ children }: { children: ReactNode }) {
  return (
    <>
      {children}
      <SoundToggle />
      <CasinoEntrance />
    </>
  );
}
