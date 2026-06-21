import { Money } from "@mainspring/schema";
import type { FilingStatus } from "@mainspring/schema";
import { addRates, maxMoney } from "../money-util";
import { applyBrackets, marginalBracketRate } from "./brackets";
import { getTaxConstants } from "./constants";
import { computeFica } from "./fica";
import { computeStateTax, stateMarginalRate } from "./state";

export interface TaxInput {
  /** Annual gross W-2 wages. */
  grossWages: Money;
  /** Pre-tax deferrals (401k_pretax + hsa + trad_ira) — reduce federal taxable income. */
  pretax: Money;
  filingStatus: FilingStatus;
  /** Two-letter state code, e.g. "TX". */
  state: string;
  /** Selects the versioned constant set. */
  taxYear: number;
}

export interface TaxResult {
  taxableIncome: Money;
  federal: Money;
  socialSecurity: Money;
  medicare: Money;
  fica: Money;
  state: Money;
  total: Money;
  /** grossWages − total tax. */
  net: Money;
  /** total / grossWages. */
  effectiveRate: string;
  /** Rate the next dollar of taxable income hits (federal + state marginal). Drives "what does a pre-tax dollar save me." */
  marginalRate: string;
}

/**
 * Compose the full tax picture for a year. Pure: given inputs + a clock-free
 * constant set, returns numbers exact to the cent.
 *
 * Order matters: pre-tax deferrals reduce the taxable base *before* the bracket
 * pass; FICA is taken on gross regardless.
 */
export function computeTax(input: TaxInput): TaxResult {
  const c = getTaxConstants(input.taxYear);
  const stdDeduction = c.standardDeduction[input.filingStatus];
  const brackets = c.federalBrackets[input.filingStatus];

  const taxableIncome = maxMoney(
    input.grossWages.subtract(input.pretax).subtract(stdDeduction),
    Money.zero(),
  );

  const federal = applyBrackets(taxableIncome, brackets);
  const fica = computeFica(input.grossWages, input.filingStatus, c.fica);
  const state = computeStateTax(taxableIncome, input.state);

  const total = federal.add(fica.total).add(state);
  const net = input.grossWages.subtract(total);

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
    total,
    net,
    effectiveRate: total.ratioTo(input.grossWages),
    marginalRate,
  };
}
