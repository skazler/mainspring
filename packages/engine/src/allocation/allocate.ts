import Decimal from "decimal.js";
import { Money } from "@mainspring/schema";
import type { DialBase } from "@mainspring/schema";
import { minMoney } from "../money-util";
import type { BucketAllocation, DialInput } from "../types";

export interface BaseAllocation {
  allocations: BucketAllocation[];
  /** Unallocated remainder of the base. */
  leftover: Money;
  /** Σ pct of dials on this base exceeded 1 (100%). */
  overAllocated: boolean;
}

/**
 * Allocate one base pool to its dials as a priority waterfall.
 *
 * Each dial wants `pct × base`, clamped down to its IRS cap. It then draws from
 * the remaining pool (so a capped bucket leaves more for lower-priority ones —
 * overflow routing falls out for free). Whatever no dial claims is `leftover`.
 *
 * Invariant: `Σ allocations + leftover == base`, exactly (property-tested).
 */
export function allocateBase(
  baseAmount: Money,
  base: DialBase,
  dials: readonly DialInput[],
): BaseAllocation {
  const ordered = [...dials].sort((a, b) => a.priority - b.priority);
  let remaining = baseAmount;
  let pctSum = new Decimal(0);
  const allocations: BucketAllocation[] = [];

  for (const dial of ordered) {
    pctSum = pctSum.plus(new Decimal(dial.pct));
    const desired = baseAmount.multiply(dial.pct);
    const capped = dial.annualCap ? minMoney(desired, dial.annualCap) : desired;
    const actual = minMoney(capped, remaining);
    allocations.push({
      bucket: dial.bucket,
      base,
      amount: actual,
      clampedByCap: capped.compare(desired) < 0,
      clampedByBase: actual.compare(capped) < 0,
    });
    remaining = remaining.subtract(actual);
  }

  return { allocations, leftover: remaining, overAllocated: pctSum.gt(1) };
}
