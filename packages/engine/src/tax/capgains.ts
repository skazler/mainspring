import { Money } from "@mainspring/schema";
import type { FilingStatus } from "@mainspring/schema";
import { maxMoney, minMoney } from "../money-util";
import type { Bracket } from "./brackets";
import { getTaxConstants } from "./constants";

export interface CapitalGainsInput {
  /** Ordinary taxable income from computeTax — sets the stacking point for LT gains. */
  ordinaryTaxableIncome: Money;
  /** Net long-term realized gains + qualified dividends (treated as 0 if a net loss). */
  longTermGains: Money;
  /** Net investment income for NIIT (ST + LT gains + qualified dividends, etc.). */
  netInvestmentIncome: Money;
  /** Modified AGI for the NIIT threshold test. */
  modifiedAGI: Money;
  filingStatus: FilingStatus;
  taxYear: number;
}

export interface CapitalGainsResult {
  longTermTax: Money;
  niit: Money;
  total: Money;
}

/**
 * Tax preferential long-term gains by stacking them *above* ordinary taxable
 * income through the 0/15/20% brackets — which rate a LT dollar hits depends on
 * total income. Plus the 3.8% NIIT over the statutory MAGI threshold.
 */
export function computeCapitalGainsTax(input: CapitalGainsInput): CapitalGainsResult {
  const c = getTaxConstants(input.taxYear);
  const longTermTax = stackedLongTermTax(
    input.ordinaryTaxableIncome,
    maxMoney(input.longTermGains, Money.zero()),
    c.longTermCapGainsBrackets[input.filingStatus],
  );

  const niitThreshold = c.niit.threshold[input.filingStatus];
  const overThreshold = maxMoney(input.modifiedAGI.subtract(niitThreshold), Money.zero());
  const niitBase = minMoney(maxMoney(input.netInvestmentIncome, Money.zero()), overThreshold);
  const niit = niitBase.multiply(c.niit.rate);

  return { longTermTax, niit, total: longTermTax.add(niit) };
}

/**
 * Tax `gains` occupying the income band [ordinaryTaxable, ordinaryTaxable+gains],
 * each slice at the LT rate for the bracket it falls in.
 */
function stackedLongTermTax(ordinaryTaxable: Money, gains: Money, brackets: readonly Bracket[]): Money {
  if (gains.compare(Money.zero()) <= 0) return Money.zero();
  const start = ordinaryTaxable;
  const end = ordinaryTaxable.add(gains);
  let tax = Money.zero();
  let bracketLow = Money.zero();
  for (const b of brackets) {
    const bracketHigh = b.upTo ?? end;
    const lo = maxMoney(start, bracketLow);
    const hi = minMoney(end, bracketHigh);
    if (hi.compare(lo) > 0) {
      tax = tax.add(hi.subtract(lo).multiply(b.rate));
    }
    bracketLow = bracketHigh;
    if (end.compare(bracketHigh) <= 0) break;
  }
  return tax;
}
