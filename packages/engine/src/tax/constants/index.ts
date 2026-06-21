import type { Money } from "@mainspring/schema";
import type { FilingStatus } from "@mainspring/schema";
import type { Bracket } from "../brackets";
import {
  contributionLimits2026,
  federalBrackets2026,
  fica2026,
  longTermCapGainsBrackets2026,
  niit2026,
  standardDeduction2026,
} from "./2026";

export interface FicaConstants {
  socialSecurityRate: string;
  socialSecurityWageBase: Money;
  medicareRate: string;
  additionalMedicareRate: string;
  additionalMedicareThreshold: Record<FilingStatus, Money>;
}

export interface NiitConstants {
  rate: string;
  threshold: Record<FilingStatus, Money>;
}

export interface TaxConstants {
  year: number;
  standardDeduction: Record<FilingStatus, Money>;
  federalBrackets: Record<FilingStatus, Bracket[]>;
  fica: FicaConstants;
  longTermCapGainsBrackets: Record<FilingStatus, Bracket[]>;
  niit: NiitConstants;
  contributionLimits: typeof contributionLimits2026;
}

const REGISTRY: Record<number, TaxConstants> = {
  2026: {
    year: 2026,
    standardDeduction: standardDeduction2026,
    federalBrackets: federalBrackets2026,
    fica: fica2026,
    longTermCapGainsBrackets: longTermCapGainsBrackets2026,
    niit: niit2026,
    contributionLimits: contributionLimits2026,
  },
};

/** Select the versioned constant set for a tax year (e.g. taxProfile.taxYear). */
export function getTaxConstants(year: number): TaxConstants {
  const c = REGISTRY[year];
  if (!c) {
    throw new Error(
      `No tax constants for year ${year}. Add packages/engine/src/tax/constants/${year}.ts and register it.`,
    );
  }
  return c;
}

export const supportedTaxYears = (): number[] => Object.keys(REGISTRY).map(Number);
