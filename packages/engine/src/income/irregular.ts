import { Money } from "@mainspring/schema";

/** One-off income logged when it arrives — a gig payout, a gift, a sale. */
export interface IncomeEntry {
  amount: Money;
  /** ISO date, e.g. "2026-07-04". */
  receivedAt: string;
  /** Taxed as self-employment profit (income tax + SE tax). False = untaxed (gift, reimbursement). */
  selfEmployed: boolean;
  /**
   * Spend it this month instead of spreading it across the plan. Such an entry
   * raises the month it arrived in's budget by its after-tax amount and stays
   * out of the trailing-year figure — counting it in both would pay it out twice.
   */
  toBudget: boolean;
}

/** Irregular income split by how it's taxed. */
export interface IncomeSplit {
  selfEmployed: Money;
  untaxed: Money;
}

/** Length of the plan's income window, in days. */
export const INCOME_WINDOW_DAYS = 365;

/** Days since the Unix epoch for a YYYY-MM-DD prefix. UTC, so no TZ drift. */
function dayIndex(iso: string): number {
  const [y, m, d] = String(iso).slice(0, 10).split("-").map(Number);
  return Math.floor(Date.UTC(y ?? 1970, (m ?? 1) - 1, d ?? 1) / 86_400_000);
}

function split(entries: readonly IncomeEntry[]): IncomeSplit {
  let selfEmployed = Money.zero();
  let untaxed = Money.zero();
  for (const e of entries) {
    if (e.selfEmployed) selfEmployed = selfEmployed.add(e.amount);
    else untaxed = untaxed.add(e.amount);
  }
  return { selfEmployed, untaxed };
}

/**
 * Irregular income the plan counts: everything received in the trailing year
 * (inclusive of `asOf`), NOT scaled up.
 *
 * Deliberately unlike `annualizeTrailing` for spending. Spending is steady
 * enough that 30 days predicts a year; a $2,000 gig in a 30-day window would
 * read as $24k/yr and then vanish a month later. Lumpy income only averages out
 * over a full year, and it isn't extrapolated from a short history either — a
 * first payout counts once, not twelve times. The window slides daily, so an
 * entry ages out a year after it arrived rather than every January 1st.
 *
 * Entries marked `toBudget` are excluded (see `IncomeEntry.toBudget`).
 * Pure; no clock — pass `asOf` (YYYY-MM-DD).
 */
export function trailingIncome(
  entries: readonly IncomeEntry[],
  asOf: string,
  windowDays: number = INCOME_WINDOW_DAYS,
): IncomeSplit {
  const end = dayIndex(asOf);
  const start = end - windowDays + 1;
  return split(
    entries.filter((e) => {
      if (e.toBudget) return false;
      const d = dayIndex(e.receivedAt);
      return d >= start && d <= end;
    }),
  );
}

/** Budget-bound income received in one calendar month (YYYY-MM). */
export function budgetIncomeIn(entries: readonly IncomeEntry[], month: string): IncomeSplit {
  return split(entries.filter((e) => e.toBudget && String(e.receivedAt).slice(0, 7) === month));
}
