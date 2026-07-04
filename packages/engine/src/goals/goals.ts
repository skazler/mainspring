import Decimal from "decimal.js";
import { Money } from "@mainspring/schema";
import { maxMoney } from "../money-util";

export interface GoalInput {
  target: Money;
  saved: Money;
  /** Amount set aside per month toward this goal. */
  monthlyContribution?: Money;
  /** Optional deadline (ISO date). */
  targetDate?: string;
}

export interface GoalStatus {
  /** saved / target, as a decimal string (capped at 1 for display). */
  progress: string;
  /** max(0, target − saved). */
  remaining: Money;
  complete: boolean;
  /** Months to reach the target at the current contribution; null if none/zero. 0 if complete. */
  monthsToGoal: number | null;
  /** Contribution needed each month to hit the deadline; null if no date or already met. */
  requiredMonthly: Money | null;
}

/** Progress, ETA, and required monthly for a savings goal. Pure; `asOf` is the clock. */
export function goalStatus(goal: GoalInput, asOf: string): GoalStatus {
  const remaining = maxMoney(goal.target.subtract(goal.saved), Money.zero());
  const complete = remaining.isZero();
  const rawProgress = goal.target.isZero() ? "1" : goal.saved.ratioTo(goal.target, 4);
  const progress = Number(rawProgress) > 1 ? "1" : rawProgress;

  let monthsToGoal: number | null = complete ? 0 : null;
  const monthly = goal.monthlyContribution;
  if (!complete && monthly && !monthly.isZero() && !monthly.isNegative()) {
    monthsToGoal = new Decimal(remaining.toString()).div(new Decimal(monthly.toString())).ceil().toNumber();
  }

  let requiredMonthly: Money | null = null;
  if (goal.targetDate && !complete) {
    const months = monthsBetween(asOf, goal.targetDate);
    if (months > 0) requiredMonthly = remaining.multiply(new Decimal(1).div(months));
  }

  return { progress, remaining, complete, monthsToGoal, requiredMonthly };
}

/** Whole months from `from` to `to` (ISO dates); negative if `to` is in the past. */
export function monthsBetween(from: string, to: string): number {
  const [fy, fm] = from.split("-").map(Number);
  const [ty, tm] = to.split("-").map(Number);
  return (ty! - fy!) * 12 + (tm! - fm!);
}
