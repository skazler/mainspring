import { Money } from "@mainspring/schema";
import type { FilingStatus } from "@mainspring/schema";
import { addRates, maxMoney } from "../money-util";
import { applyBrackets, marginalBracketRate } from "./brackets";
import { computeCapitalGainsTax } from "./capgains";
import { getTaxConstants } from "./constants";
import { computeFica } from "./fica";
import { computeStateTax, stateMarginalRate } from "./state";

export interface TaxInput {
  /** Annual gross W-2 wages. */
  grossWages: Money;
  /** Pre-tax deferrals (401k_pretax + hsa + ira) — reduce federal taxable income. */
  pretax: Money;
  filingStatus: FilingStatus;
  /** Two-letter state code, e.g. "TX". */
  state: string;
  /** Selects the versioned constant set. */
  taxYear: number;
  /** Realized short-term gains (taxed as ordinary income). Default 0. */
  shortTermGains?: Money;
  /** Realized long-term gains + qualified dividends (preferential rates). Default 0. */
  longTermGains?: Money;
}

export interface TaxResult {
  taxableIncome: Money;
  federal: Money;
  socialSecurity: Money;
  medicare: Money;
  fica: Money;
  state: Money;
  /** Tax on long-term gains at preferential rates. */
  longTermCapGainsTax: Money;
  /** Net Investment Income Tax (3.8%). */
  niit: Money;
  /** longTermCapGainsTax + niit. */
  capitalGains: Money;
  total: Money;
  /** (wages + realized gains) − total tax. */
  net: Money;
  /** total / (wages + realized gains). */
  effectiveRate: string;
  /** Rate the next dollar of ordinary taxable income hits (federal + state marginal). */
  marginalRate: string;
}

/**
 * Compose the full tax picture for a year. Pure: given inputs + a clock-free
 * constant set, returns numbers exact to the cent.
 *
 * Ordering: pre-tax deferrals reduce the taxable base before the bracket pass;
 * short-term gains fold into ordinary income; FICA is on wages only; long-term
 * gains are taxed separately, stacked above ordinary income (+ NIIT).
 */
export function computeTax(input: TaxInput): TaxResult {
  const c = getTaxConstants(input.taxYear);
  const stdDeduction = c.standardDeduction[input.filingStatus];
  const brackets = c.federalBrackets[input.filingStatus];

  const stGains = input.shortTermGains ?? Money.zero();
  const ltGains = input.longTermGains ?? Money.zero();

  // Short-term gains are ordinary income.
  const taxableIncome = maxMoney(
    input.grossWages.add(stGains).subtract(input.pretax).subtract(stdDeduction),
    Money.zero(),
  );

  const federal = applyBrackets(taxableIncome, brackets);
  const fica = computeFica(input.grossWages, input.filingStatus, c.fica);
  const state = computeStateTax(taxableIncome, input.state);

  const modifiedAGI = input.grossWages.subtract(input.pretax).add(stGains).add(ltGains);
  const cg = computeCapitalGainsTax({
    ordinaryTaxableIncome: taxableIncome,
    longTermGains: ltGains,
    netInvestmentIncome: stGains.add(ltGains),
    modifiedAGI,
    filingStatus: input.filingStatus,
    taxYear: input.taxYear,
  });

  const total = federal.add(fica.total).add(state).add(cg.total);
  const totalIncome = input.grossWages.add(stGains).add(ltGains);
  const net = totalIncome.subtract(total);

  const marginalRate = addRates(
    marginalBracketRate(taxableIncome, brackets),
    stateMarginalRate(input.state),
  );

  return {
    taxableIncome,
    federal,
    socialSecurity: fica.socialSecurity,
    medicare: fica.medicare,
    fica: fica.total,
    state,
    longTermCapGainsTax: cg.longTermTax,
    niit: cg.niit,
    capitalGains: cg.total,
    total,
    net,
    effectiveRate: total.ratioTo(totalIncome),
    marginalRate,
  };
}
