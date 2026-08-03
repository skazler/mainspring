import { Money, MoneyDecimal } from "@mainspring/schema";

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
  return total.multiply(new MoneyDecimal(12).div(months.size));
}

/**
 * Current run-rate: the given month's spending × 12. Resets naturally each month
 * (a new month starts from zero), so the plan reflects "this month, projected
 * out" rather than a lifetime average.
 *
 * NOTE: superseded by `annualizeTrailing` for the figure that feeds the plan —
 * a calendar month resets to ~0 on the 1st, which collapsed the FI number (and
 * inflated savings) for the first days of every month. Kept for the UI's
 * "this month so far" readout and for callers that want calendar buckets.
 */
export function annualizeMonth(entries: readonly SpendingEntry[], month: string): Money {
  return monthTotal(entries, month).multiply("12");
}

/** Length of the trailing window, in days. */
export const TRAILING_WINDOW_DAYS = 30;
/**
 * Shortest history we'll extrapolate a whole year from. Below this, one $80
 * grocery run on day 1 would imply $29k/yr; the floor damps that spike while
 * the window fills in.
 */
export const MIN_TRAILING_DAYS = 7;

/** Days since the Unix epoch for a YYYY-MM-DD prefix. UTC, so no TZ drift. */
function dayIndex(iso: string): number {
  const [y, m, d] = String(iso).slice(0, 10).split("-").map(Number);
  return Math.floor(Date.UTC(y ?? 1970, (m ?? 1) - 1, d ?? 1) / 86_400_000);
}

/**
 * Trailing-window run-rate: spending over the last `windowDays` (inclusive of
 * `asOf`), scaled to a year. Unlike `annualizeMonth` there is no month boundary
 * to fall off — the window slides one day at a time, so the plan moves smoothly
 * instead of sawtoothing every 1st.
 *
 * Onboarding: a user three days into logging has no 30-day history, and
 * dividing by a window they haven't lived would under-report badly. The divisor
 * is therefore the span actually covered — from their earliest entry to `asOf`
 * — capped at `windowDays` and floored at `MIN_TRAILING_DAYS`. Coverage is
 * measured from the earliest entry overall, not the earliest one *inside* the
 * window, so an established user who simply spent nothing last week is not
 * treated as a new user (which would divide by 7 and overstate wildly).
 *
 * Pure; no clock — pass `asOf` (YYYY-MM-DD).
 */
export function annualizeTrailing(
  entries: readonly SpendingEntry[],
  asOf: string,
  windowDays: number = TRAILING_WINDOW_DAYS,
): Money {
  if (entries.length === 0) return Money.zero();

  const end = dayIndex(asOf);
  const start = end - windowDays + 1;

  let total = Money.zero();
  let earliest = Infinity;
  for (const e of entries) {
    const d = dayIndex(e.spentAt);
    if (d < earliest) earliest = d;
    if (d >= start && d <= end) total = total.add(e.amount);
  }
  if (total.isZero()) return Money.zero();

  const covered = Math.max(MIN_TRAILING_DAYS, Math.min(windowDays, end - earliest + 1));
  return total.multiply(new MoneyDecimal(365).div(covered));
}

/** Sum over the trailing window, no annualization — for the UI readout. */
export function trailingTotal(
  entries: readonly SpendingEntry[],
  asOf: string,
  windowDays: number = TRAILING_WINDOW_DAYS,
): Money {
  const end = dayIndex(asOf);
  const start = end - windowDays + 1;
  return entries
    .filter((e) => {
      const d = dayIndex(e.spentAt);
      return d >= start && d <= end;
    })
    .reduce((sum, e) => sum.add(e.amount), Money.zero());
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
