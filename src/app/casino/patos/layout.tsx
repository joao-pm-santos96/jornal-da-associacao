import type { ReactNode } from "react";
import { GameGate } from "../GameGate";

export default function Layout({ children }: { children: ReactNode }) {
  return <GameGate game="patos">{children}</GameGate>;
}
