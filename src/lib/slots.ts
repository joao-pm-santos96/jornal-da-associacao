import "server-only";
import { randomInt } from "node:crypto";
import { SLOT_SYMBOLS, TOTAL_WEIGHT } from "./slot-table";

export { SLOT_BETS, multiplier, type SlotBet } from "./slot-table";

function drawSymbol(): string {
  let roll = randomInt(TOTAL_WEIGHT);
  for (const s of SLOT_SYMBOLS) {
    if (roll < s.weight) return s.emoji;
    roll -= s.weight;
  }
  return SLOT_SYMBOLS[0].emoji;
}

export function spinReels(): [string, string, string] {
  return [drawSymbol(), drawSymbol(), drawSymbol()];
}
