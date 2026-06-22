import Decimal from "decimal.js";
import { Money } from "@mainspring/schema";

export interface ProjectionInput {
  currentBalance: Money;
  /** Saved per year (real dollars). */
  annualContribution: Money;
  /** Assumed real (inflation-adjusted) return, e.g. "0.05". */
  realReturn: string;
  years: number;
}

/**
 * Deterministic year-by-year compounding (PREDICTION_ENGINE §1):
 *   balance[t] = balance[t-1] · (1 + rReal) + annualContribution
 * Returns the end-of-year balance for each year 1..years. Pure, exact.
 */
export function projectBalances(input: ProjectionInput): Money[] {
  const onePlusR = new Decimal(1).plus(new Decimal(input.realReturn));
  const series: Money[] = [];
  let balance = input.currentBalance;
  for (let y = 0; y < input.years; y++) {
    balance = balance.multiply(onePlusR).add(input.annualContribution);
    series.push(balance);
  }
  return series;
}
