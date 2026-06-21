import { Money } from "@mainspring/schema";
import type { Frequency } from "@mainspring/schema";
import type { IncomeSourceInput } from "../types";

/** Pay periods per year by frequency. */
export const PERIODS_PER_YEAR: Record<Frequency, number> = {
  weekly: 52,
  biweekly: 26,
  monthly: 12,
  annual: 1,
};

/** Annualize and sum gross income across sources. Pure, exact. */
export function annualizeIncome(sources: readonly IncomeSourceInput[]): Money {
  return sources.reduce(
    (sum, s) => sum.add(s.grossAmount.multiply(String(PERIODS_PER_YEAR[s.frequency]))),
    Money.zero(),
  );
}
