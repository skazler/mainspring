import { Money } from "@mainspring/schema";
import type { FilingStatus } from "@mainspring/schema";
import { minMoney } from "../money-util";
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
