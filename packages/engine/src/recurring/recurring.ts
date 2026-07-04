import { Money } from "@mainspring/schema";

/** How often a recurring item is charged. */
export type Cadence = "weekly" | "biweekly" | "monthly" | "quarterly" | "annual";

/** What a recurring item does to the plan: a bill (expense) or an auto-invest (contribution). */
export type RecurringKind = "bill" | "investment";

export interface RecurringItem {
  /** Amount charged per occurrence (not annualized). */
  amount: Money;
  cadence: Cadence;
  category?: string;
  /** "bill" (default) subtracts from income; "investment" adds to contributions. */
  kind?: RecurringKind;
  /** Paused items are kept for reference but excluded from the plan. Default true. */
  active?: boolean;
}

const PER_YEAR: Record<Cadence, string> = {
  weekly: "52",
  biweekly: "26",
  monthly: "12",
  quarterly: "4",
  annual: "1",
};

/** Annualize a single item (amount × occurrences per year). */
export function annualizeItem(item: RecurringItem): Money {
  return item.amount.multiply(PER_YEAR[item.cadence]);
}

/**
 * Total annual cost of all active recurring items. Pure; paused items are
 * ignored. Pre-filter by `kind` at the call site to total bills vs investments.
 */
export function annualizeRecurring(items: readonly RecurringItem[]): Money {
  return items.reduce(
    (sum, i) => (i.active === false ? sum : sum.add(annualizeItem(i))),
    Money.zero(),
  );
}

/** Annualized totals per category, largest first — for the category comparison. */
export function recurringByCategory(items: readonly RecurringItem[]): { category: string; annual: Money }[] {
  const map = new Map<string, Money>();
  for (const i of items) {
    if (i.active === false) continue;
    const key = i.category ?? "other";
    map.set(key, (map.get(key) ?? Money.zero()).add(annualizeItem(i)));
  }
  return [...map]
    .map(([category, annual]) => ({ category, annual }))
    .sort((a, b) => b.annual.compare(a.annual));
}
