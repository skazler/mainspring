import Decimal from "decimal.js";
import type { DialBase } from "@mainspring/schema";
import type { DialInput } from "../types";

/**
 * Remaining allocatable fraction on a base, excluding one dial (the one being
 * dragged). Dial percentages on a shared base cannot sum past 1 (MONEY_ENGINE §4),
 * so this is the ceiling for the excluded dial.
 */
export function remainingPct(
  dials: readonly DialInput[],
  base: DialBase,
  excludeIndex: number,
): string {
  const used = dials.reduce(
    (sum, d, i) => (i === excludeIndex || d.base !== base ? sum : sum.plus(new Decimal(d.pct))),
    new Decimal(0),
  );
  return Decimal.max(new Decimal(0), new Decimal(1).minus(used)).toString();
}

/** Clamp a proposed fraction into [0, maxPct]. */
export function constrainPct(proposed: string, maxPct: string): string {
  return Decimal.max(new Decimal(0), Decimal.min(new Decimal(proposed), new Decimal(maxPct))).toString();
}
