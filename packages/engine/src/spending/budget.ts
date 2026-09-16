import { Money, MoneyDecimal } from "@mainspring/schema";

const ONE_TWELFTH = new MoneyDecimal(1).div(12);

export interface MonthlyBudget {
  /** This month's discretionary allowance, including any extra income. */
  allowance: Money;
  /** Extra after-tax income added to this month only (already inside `allowance`). */
  extra: Money;
  /** Variable spending logged so far this calendar month. */
  spent: Money;
  /** allowance − spent. Negative once the month is overspent. */
  remaining: Money;
  /** spent / allowance as a rate string ("0.000000" when there is no allowance). */
  used: string;
  /** The fixed plan alone outruns take-home — there is no allowance to budget. */
  overCommitted: boolean;
}

/**
 * The month's spending budget: a fixed allowance, minus what's been spent since
 * the 1st.
 *
 * `annualAllowance` is clock-free (gross − taxes − contributions − goals −
 * bills), so the allowance is the same number on the 3rd as on the 28th. Only
 * `spentThisMonth` moves during the month, and it only grows — so `remaining`
 * falls monotonically and resets to the full allowance on the 1st.
 *
 * This is deliberately NOT the trailing-window run-rate that feeds the FI
 * projection (`annualizeTrailing`). That window slides, so purchases age out of
 * it mid-month and push a "remaining" figure back *up* — correct for a run-rate,
 * wrong for a budget, where a dollar spent is spent until the month ends.
 *
 * `extra` is income the user chose to spend this month (after tax — see
 * `RecomputeView.budgetIncome`). It lands whole in the month it arrived rather
 * than as a twelfth, and it can pull an over-committed month back above zero:
 * that money genuinely covers the gap, just for this month.
 *
 * A negative allowance means the fixed plan already outruns take-home; spending
 * nothing would not close the gap. That's `overCommitted`, a different problem
 * from overspending, so callers can say so rather than showing a budget that was
 * blown before the month began.
 */
export function monthlyBudget(annualAllowance: Money, spentThisMonth: Money, extra: Money = Money.zero()): MonthlyBudget {
  const allowance = annualAllowance.multiply(ONE_TWELFTH).add(extra);
  const overCommitted = allowance.isNegative();
  return {
    allowance,
    extra,
    spent: spentThisMonth,
    remaining: allowance.subtract(spentThisMonth),
    used: overCommitted ? new MoneyDecimal(0).toFixed(6) : spentThisMonth.ratioTo(allowance),
    overCommitted,
  };
}
