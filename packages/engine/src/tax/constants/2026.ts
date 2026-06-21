import { Money } from "@mainspring/schema";
import type { FilingStatus } from "@mainspring/schema";
import type { Bracket } from "../brackets";
import type { FicaConstants, NiitConstants } from "./index";

/**
 * 2026 US federal tax constants.
 *
 * ⚠️ VERIFY before trusting a projection. These reflect the IRS 2026 inflation
 * adjustments (Rev. Proc. 2025-32) to the best available figures; brackets,
 * standard deduction, FICA wage base, and contribution limits change yearly and
 * must be checked against IRS publications. This is a calculation model, not tax
 * advice. The golden tests are computed *consistently with these constants*, so a
 * constant change requires a deliberate golden update.
 */

const m = (s: string) => Money.of(s);

export const standardDeduction2026: Record<FilingStatus, Money> = {
  single: m("16100"),
  mfj: m("32200"),
  mfs: m("16100"),
  hoh: m("24150"),
};

export const federalBrackets2026: Record<FilingStatus, Bracket[]> = {
  single: [
    { upTo: m("12400"), rate: "0.10" },
    { upTo: m("50400"), rate: "0.12" },
    { upTo: m("105700"), rate: "0.22" },
    { upTo: m("201775"), rate: "0.24" },
    { upTo: m("256225"), rate: "0.32" },
    { upTo: m("640600"), rate: "0.35" },
    { upTo: null, rate: "0.37" },
  ],
  mfj: [
    { upTo: m("24800"), rate: "0.10" },
    { upTo: m("100800"), rate: "0.12" },
    { upTo: m("211400"), rate: "0.22" },
    { upTo: m("403550"), rate: "0.24" },
    { upTo: m("512450"), rate: "0.32" },
    { upTo: m("768700"), rate: "0.35" },
    { upTo: null, rate: "0.37" },
  ],
  mfs: [
    { upTo: m("12400"), rate: "0.10" },
    { upTo: m("50400"), rate: "0.12" },
    { upTo: m("105700"), rate: "0.22" },
    { upTo: m("201775"), rate: "0.24" },
    { upTo: m("256225"), rate: "0.32" },
    { upTo: m("384350"), rate: "0.35" },
    { upTo: null, rate: "0.37" },
  ],
  hoh: [
    { upTo: m("17700"), rate: "0.10" },
    { upTo: m("67450"), rate: "0.12" },
    { upTo: m("105700"), rate: "0.22" },
    { upTo: m("201775"), rate: "0.24" },
    { upTo: m("256225"), rate: "0.32" },
    { upTo: m("640600"), rate: "0.35" },
    { upTo: null, rate: "0.37" },
  ],
};

export const fica2026: FicaConstants = {
  socialSecurityRate: "0.062",
  socialSecurityWageBase: m("184500"),
  medicareRate: "0.0145",
  additionalMedicareRate: "0.009",
  // Statutory thresholds — NOT inflation-adjusted.
  additionalMedicareThreshold: {
    single: m("200000"),
    mfj: m("250000"),
    mfs: m("125000"),
    hoh: m("200000"),
  },
};

/**
 * Long-term capital-gains brackets (also for qualified dividends). Thresholds are
 * *taxable-income* breakpoints; LT gains stack above ordinary taxable income.
 */
export const longTermCapGainsBrackets2026: Record<FilingStatus, Bracket[]> = {
  single: [
    { upTo: m("49450"), rate: "0.00" },
    { upTo: m("545500"), rate: "0.15" },
    { upTo: null, rate: "0.20" },
  ],
  mfj: [
    { upTo: m("98900"), rate: "0.00" },
    { upTo: m("613700"), rate: "0.15" },
    { upTo: null, rate: "0.20" },
  ],
  mfs: [
    { upTo: m("49450"), rate: "0.00" },
    { upTo: m("306850"), rate: "0.15" },
    { upTo: null, rate: "0.20" },
  ],
  hoh: [
    { upTo: m("66200"), rate: "0.00" },
    { upTo: m("579650"), rate: "0.15" },
    { upTo: null, rate: "0.20" },
  ],
};

/** Net Investment Income Tax — 3.8% over a statutory (non-indexed) MAGI threshold. */
export const niit2026: NiitConstants = {
  rate: "0.038",
  threshold: {
    single: m("200000"),
    mfj: m("250000"),
    mfs: m("125000"),
    hoh: m("200000"),
  },
};

/** Contribution limits — used by the allocation engine (Phase 3); included here as the yearly source. */
export const contributionLimits2026 = {
  elective401k: m("24500"),
  elective401kCatchUp50: m("8000"),
  iraLimit: m("7500"),
  iraCatchUp50: m("1100"),
  hsaSelfOnly: m("4400"),
  hsaFamily: m("8750"),
  hsaCatchUp55: m("1000"),
} as const;
