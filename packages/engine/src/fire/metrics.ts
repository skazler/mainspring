import { Money, MoneyDecimal } from "@mainspring/schema";
import { projectBalances } from "./project";

export interface FireInput {
  /** Total invested assets today. */
  currentBalance: Money;
  /** Saved per year (from recompute's totalContributions). */
  annualContribution: Money;
  annualExpenses: Money;
  /** Safe withdrawal rate, e.g. "0.04". */
  swr: string;
  /** Assumed real return, e.g. "0.05". */
  realReturn: string;
  currentAge: number;
  targetRetireAge: number;
  /** Search horizon for time-to-FI, in years. Default 80. */
  horizonYears?: number;
}

export interface FireMetrics {
  /** annualExpenses / swr (4% → ×25). */
  fiNumber: Money;
  alreadyFI: boolean;
  /** Years until balance ≥ fiNumber; null if not reached within the horizon. */
  yearsToFI: number | null;
  fiAge: number | null;
  /** Amount that, left alone, coasts to fiNumber by targetRetireAge. */
  coastNumber: Money;
  coastReached: boolean;
}

/** FI number = annualExpenses / swr. */
export function fiNumberFor(annualExpenses: Money, swr: string): Money {
  return annualExpenses.multiply(new MoneyDecimal(1).div(new MoneyDecimal(swr)));
}

/** Coast FIRE number = fiNumber / (1 + rReal)^(yearsToTargetRetire). */
export function coastNumberFor(
  fiNumber: Money,
  realReturn: string,
  currentAge: number,
  targetRetireAge: number,
): Money {
  const years = Math.max(0, targetRetireAge - currentAge);
  const growth = new MoneyDecimal(1).plus(new MoneyDecimal(realReturn)).pow(years);
  return fiNumber.multiply(new MoneyDecimal(1).div(growth));
}

/** Deterministic FIRE metrics derived from the projection. Pure, no clock. */
export function fireMetrics(input: FireInput): FireMetrics {
  const fiNumber = fiNumberFor(input.annualExpenses, input.swr);
  const coastNumber = coastNumberFor(fiNumber, input.realReturn, input.currentAge, input.targetRetireAge);
  const coastReached = input.currentBalance.compare(coastNumber) >= 0;

  if (input.currentBalance.compare(fiNumber) >= 0) {
    return { fiNumber, alreadyFI: true, yearsToFI: 0, fiAge: input.currentAge, coastNumber, coastReached };
  }

  const series = projectBalances({
    currentBalance: input.currentBalance,
    annualContribution: input.annualContribution,
    realReturn: input.realReturn,
    years: input.horizonYears ?? 80,
  });

  let yearsToFI: number | null = null;
  for (let i = 0; i < series.length; i++) {
    if (series[i]!.compare(fiNumber) >= 0) {
      yearsToFI = i + 1;
      break;
    }
  }

  return {
    fiNumber,
    alreadyFI: false,
    yearsToFI,
    fiAge: yearsToFI === null ? null : input.currentAge + yearsToFI,
    coastNumber,
    coastReached,
  };
}
