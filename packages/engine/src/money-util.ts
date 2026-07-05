import { Money, MoneyDecimal } from "@mainspring/schema";

export function minMoney(a: Money, b: Money): Money {
  return a.compare(b) <= 0 ? a : b;
}

export function maxMoney(a: Money, b: Money): Money {
  return a.compare(b) >= 0 ? a : b;
}

/** Add two dimensionless rate strings exactly (e.g. federal + state marginal). */
export function addRates(a: string, b: string): string {
  return new MoneyDecimal(a).plus(new MoneyDecimal(b)).toString();
}
