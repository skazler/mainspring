import Decimal from "decimal.js";
import { Money } from "@mainspring/schema";

export interface SpendingEntry {
  category: string;
  amount: Money;
  /** ISO date, e.g. "2026-07-04". */
  spentAt: string;
}

/**
 * Annualize logged variable spending by the number of distinct months it spans,
 * so a partial history extrapolates sensibly: $200 of coffee across 2 months →
 * ~$1,200/yr. Pure; no clock (uses the months present in the data).
 */
export function annualizeSpending(entries: readonly SpendingEntry[]): Money {
  if (entries.length === 0) return Money.zero();
  // String() guards against a non-string date leaking in (e.g. a raw pg Date).
  const months = new Set(entries.map((e) => String(e.spentAt).slice(0, 7)));
  const total = entries.reduce((sum, e) => sum.add(e.amount), Money.zero());
  return total.multiply(new Decimal(12).div(months.size));
}

/**
 * Current run-rate: the given month's spending × 12. Resets naturally each month
 * (a new month starts from zero), so the plan reflects "this month, projected
 * out" rather than a lifetime average.
 */
export function annualizeMonth(entries: readonly SpendingEntry[], month: string): Money {
  return monthTotal(entries, month).multiply("12");
}

/** Sum of a single month's entries (YYYY-MM), no annualization. */
export function monthTotal(entries: readonly SpendingEntry[], month: string): Money {
  return entries
    .filter((e) => String(e.spentAt).slice(0, 7) === month)
    .reduce((sum, e) => sum.add(e.amount), Money.zero());
}

/** Totals per category, largest first — for the spending breakdown. */
export function spendingByCategory(entries: readonly SpendingEntry[]): { category: string; total: Money }[] {
  const map = new Map<string, Money>();
  for (const e of entries) {
    map.set(e.category, (map.get(e.category) ?? Money.zero()).add(e.amount));
  }
  return [...map]
    .map(([category, total]) => ({ category, total }))
    .sort((a, b) => b.total.compare(a.total));
}
