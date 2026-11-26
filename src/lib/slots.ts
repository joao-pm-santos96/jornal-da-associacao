import "server-only";
import { randomInt } from "node:crypto";
import { totalWeight, type SlotPay } from "./slot-table";

export { multiplier } from "./slot-table";

function drawSymbol(pays: readonly SlotPay[]): string {
  let roll = randomInt(totalWeight(pays));
  for (const s of pays) {
    if (roll < s.weight) return s.emoji;
    roll -= s.weight;
  }
  return pays[0].emoji;
}

export function spinReels(pays: readonly SlotPay[]): [string, string, string] {
  return [drawSymbol(pays), drawSymbol(pays), drawSymbol(pays)];
}
