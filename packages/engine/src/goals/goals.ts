import { Money, MoneyDecimal } from "@mainspring/schema";
import { maxMoney } from "../money-util";

export interface GoalInput {
  target: Money;
  saved: Money;
  /** Amount set aside per month toward this goal. */
  monthlyContribution?: Money;
  /**
   * Optional timeline: how many months you want to reach it in. A horizon you
   * set and edit, not a date — "in 25 months" survives being read six weeks
   * later, where a deadline silently becomes a different plan every day.
   */
  targetMonths?: number;
}

export interface GoalStatus {
  /** saved / target, as a decimal string (capped at 1 for display). */
  progress: string;
  /** max(0, target − saved). */
  remaining: Money;
  complete: boolean;
  /** Months to reach the target at the current contribution; null if none/zero. 0 if complete. */
  monthsToGoal: number | null;
  /** Contribution needed each month to finish inside the timeline; null if no timeline or already met. */
  requiredMonthly: Money | null;
}

/**
 * Progress, ETA, and required monthly for a savings goal. Pure — and now
 * clock-free: the timeline is a span the user owns, so nothing here depends on
 * today's date.
 */
export function goalStatus(goal: GoalInput): GoalStatus {
  const remaining = maxMoney(goal.target.subtract(goal.saved), Money.zero());
  const complete = remaining.isZero();
  const rawProgress = goal.target.isZero() ? "1" : goal.saved.ratioTo(goal.target, 4);
  const progress = Number(rawProgress) > 1 ? "1" : rawProgress;

  let monthsToGoal: number | null = complete ? 0 : null;
  const monthly = goal.monthlyContribution;
  if (!complete && monthly && !monthly.isZero() && !monthly.isNegative()) {
    monthsToGoal = new MoneyDecimal(remaining.toString()).div(new MoneyDecimal(monthly.toString())).ceil().toNumber();
  }

  let requiredMonthly: Money | null = null;
  const months = goal.targetMonths;
  if (months !== undefined && months > 0 && !complete) {
    requiredMonthly = remaining.multiply(new MoneyDecimal(1).div(months));
  }

  return { progress, remaining, complete, monthsToGoal, requiredMonthly };
}

/**
 * Whole months from `from` to `to` (ISO dates); negative if `to` is in the past.
 * F23 caveat: this counts calendar-month boundaries and ignores the day of month
 * — `2026-01-31 → 2026-03-01` returns 2, not "just over one month". So a
 * `requiredMonthly` near a deadline can read a month optimistic. Acceptable for a
 * planning estimate; documented so it's a known behavior, not a surprise.
 */
export function monthsBetween(from: string, to: string): number {
  const [fy, fm] = from.split("-").map(Number);
  const [ty, tm] = to.split("-").map(Number);
  return (ty! - fy!) * 12 + (tm! - fm!);
}
