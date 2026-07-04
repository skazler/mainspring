import { Money } from "@mainspring/schema";

/** How often a recurring commitment is charged. */
export type Cadence = "monthly" | "quarterly" | "annual";

export interface RecurringItem {
  /** Amount charged per occurrence (not annualized). */
  amount: Money;
  cadence: Cadence;
  /** Paused items are kept for reference but excluded from the plan. Default true. */
  active?: boolean;
}

const PER_YEAR: Record<Cadence, string> = {
  monthly: "12",
  quarterly: "4",
  annual: "1",
};

/** Annualize a single commitment (amount × occurrences per year). */
export function annualizeItem(item: RecurringItem): Money {
  return item.amount.multiply(PER_YEAR[item.cadence]);
}

/**
 * Total annual cost of all active recurring commitments (insurance, car,
 * subscriptions, API costs…). Pure; paused items are ignored.
 */
export function annualizeRecurring(items: readonly RecurringItem[]): Money {
  return items.reduce(
    (sum, i) => (i.active === false ? sum : sum.add(annualizeItem(i))),
    Money.zero(),
  );
}
