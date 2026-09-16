import { Money } from "@mainspring/schema";
import type { FilingStatus } from "@mainspring/schema";
import { maxMoney, minMoney } from "../money-util";
import type { FicaConstants } from "./constants";

export interface FicaBreakdown {
  socialSecurity: Money;
  medicare: Money;
  total: Money;
}

/**
 * FICA on gross W-2 wages. Note: pre-tax 401(k)/IRA deferrals reduce *income tax*
 * but are still subject to FICA, so FICA is computed on gross — not on the
 * income-tax-reduced base.
 *
 *  - Social Security: rate up to the annual wage base (capped).
 *  - Medicare: flat rate on all wages, plus the Additional Medicare surtax on
 *    wages over the statutory (non-indexed) filing-status threshold.
 */
export function computeFica(
  grossWages: Money,
  filingStatus: FilingStatus,
  c: FicaConstants,
): FicaBreakdown {
  const ssBase = minMoney(grossWages, c.socialSecurityWageBase);
  const socialSecurity = ssBase.multiply(c.socialSecurityRate);

  let medicare = grossWages.multiply(c.medicareRate);
  const threshold = c.additionalMedicareThreshold[filingStatus];
  if (grossWages.compare(threshold) > 0) {
    medicare = medicare.add(grossWages.subtract(threshold).multiply(c.additionalMedicareRate));
  }

  return { socialSecurity, medicare, total: socialSecurity.add(medicare) };
}

export interface SelfEmploymentTax {
  /** Profit × 92.35% — the base SE tax is charged on. */
  netEarnings: Money;
  socialSecurity: Money;
  medicare: Money;
  /** Additional Medicare surtax on SE earnings over the (wage-reduced) threshold. */
  additionalMedicare: Money;
  total: Money;
  /** Half of SE tax (excluding the surtax) — an above-the-line income deduction. */
  deduction: Money;
}

/**
 * Self-employment tax (Schedule SE) on 1099 / side-gig profit — both halves of
 * FICA, since there's no employer paying the other one.
 *
 * It shares limits with W-2 wages rather than stacking beside them: wages use up
 * the Social Security wage base first, and they count toward the Additional
 * Medicare threshold, so the same dollar of side income costs more SE tax at
 * $40k of wages than at $190k. Half of the non-surtax SE tax comes back as an
 * income-tax deduction (returned here so the caller can apply it).
 */
export function computeSelfEmploymentTax(
  profit: Money,
  w2Wages: Money,
  filingStatus: FilingStatus,
  c: FicaConstants,
): SelfEmploymentTax {
  const netEarnings = maxMoney(profit.multiply(c.selfEmploymentEarningsFactor), Money.zero());
  if (netEarnings.compare(c.selfEmploymentMinimum) < 0) {
    const z = Money.zero();
    return { netEarnings, socialSecurity: z, medicare: z, additionalMedicare: z, total: z, deduction: z };
  }

  const ssRoom = maxMoney(c.socialSecurityWageBase.subtract(w2Wages), Money.zero());
  const socialSecurity = minMoney(netEarnings, ssRoom).multiply(c.socialSecurityRate).multiply("2");
  const medicare = netEarnings.multiply(c.medicareRate).multiply("2");

  const threshold = maxMoney(c.additionalMedicareThreshold[filingStatus].subtract(w2Wages), Money.zero());
  const additionalMedicare = maxMoney(netEarnings.subtract(threshold), Money.zero()).multiply(c.additionalMedicareRate);

  const total = socialSecurity.add(medicare).add(additionalMedicare);
  const deduction = socialSecurity.add(medicare).multiply("0.5");
  return { netEarnings, socialSecurity, medicare, additionalMedicare, total, deduction };
}
