import { MoneyDecimal } from "@mainspring/schema";
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
    (sum, d, i) => (i === excludeIndex || d.base !== base ? sum : sum.plus(new MoneyDecimal(d.pct))),
    new MoneyDecimal(0),
  );
  return MoneyDecimal.max(new MoneyDecimal(0), new MoneyDecimal(1).minus(used)).toString();
}

/** Clamp a proposed fraction into [0, maxPct]. */
export function constrainPct(proposed: string, maxPct: string): string {
  return MoneyDecimal.max(new MoneyDecimal(0), MoneyDecimal.min(new MoneyDecimal(proposed), new MoneyDecimal(maxPct))).toString();
}
