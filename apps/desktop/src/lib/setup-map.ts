import { Money, MoneyDecimal } from "@mainspring/schema";
import type { Bucket, DialBase, FilingStatus, Frequency } from "@mainspring/schema";
import { annualizeIncome, ASSET_CLASSES, type AssetClassId, type DialInput, type ProfileState } from "@mainspring/engine";
import { BUCKET_OPTIONS } from "./buckets";

/** A designed asset-class mix (the Calibre). Weights are decimal strings summing to 1. */
export interface Calibre {
  name: string;
  weights: Record<AssetClassId, string>;
}

/** Fill every asset class, defaulting the unspecified ones to "0". */
export function fullWeights(partial: Partial<Record<AssetClassId, string>>): Record<AssetClassId, string> {
  const w = {} as Record<AssetClassId, string>;
  for (const c of ASSET_CLASSES) w[c.id] = partial[c.id] ?? "0";
  return w;
}

/** The shipped default calibre — a classic three-fund mix (60/30/10). */
export function defaultCalibre(): Calibre {
  return { name: "Three-fund", weights: fullWeights({ us_total: "0.6", intl_dev: "0.3", bonds: "0.1" }) };
}

export interface ContributionForm {
  bucket: Bucket;
  base: DialBase;
  enabled: boolean;
  /** Enter this contribution as a percent of the base, or a fixed dollar amount. */
  mode: "percent" | "amount";
  /** Whole-number percent, e.g. 15 for 15% (when mode = percent). */
  percent: number;
  /** Fixed annual dollars (when mode = amount). Only meaningful for gross-base buckets. */
  amount: number;
  /** IRS cap in dollars, if applicable. */
  cap?: string;
}

export interface SetupForm {
  grossAmount: number;
  frequency: Frequency;
  filingStatus: FilingStatus;
  state: string;
  currentAge: number;
  targetRetireAge: number;
  currentBalance: number;
  annualExpenses: number;
  /** Whole-number percents. */
  swrPercent: number;
  realReturnPercent: number;
  /** Assumed annual inflation, whole-number percent (deflates nominal market μ). */
  inflationPct: number;
  /** Employer 401(k) match as a whole-number percent of gross, e.g. 4. */
  employerMatchPercent: number;
  /**
   * Health/dental/vision premiums withheld from each paycheck, in dollars per
   * month. Entered monthly because that's how a pay stub reads, annualized on
   * the way into the engine.
   */
  benefitPremiumsMonthly: number;
  /** The applied asset-class mix driving the forecast's return assumptions. */
  calibre: Calibre;
  contributions: ContributionForm[];
}

/**
 * A blank starting form — no personal figures baked in. Money and age fields
 * start empty/at zero so the user enters their own; only neutral structural
 * assumptions (SWR, assumed return) carry generic textbook defaults.
 */
export function defaultSetupForm(): SetupForm {
  return {
    grossAmount: 0,
    frequency: "annual",
    filingStatus: "single",
    state: "TX",
    currentAge: 0,
    targetRetireAge: 0,
    currentBalance: 0,
    annualExpenses: 0,
    swrPercent: 4,
    realReturnPercent: 5,
    inflationPct: 2.5,
    employerMatchPercent: 0,
    benefitPremiumsMonthly: 0,
    calibre: defaultCalibre(),
    contributions: BUCKET_OPTIONS.map(defaultContribution),
  };
}

// F5: exact-decimal division — never stringify a JS float artifact into the
// exact-Money pipeline (String(16.7 / 100) → "0.16699999999999998").
// A cleared number input binds to null (not 0), so guard before decimal.js sees
// it — an empty field must not crash "Wind it up". Non-finite → 0.
const frac = (percent: number): string =>
  new MoneyDecimal(Number.isFinite(percent) ? percent : 0).div(100).toString();

/** Map the setup form to the engine's ProfileState. Pure. */
export function buildProfileState(form: SetupForm): ProfileState {
  const incomeSources = [{ grossAmount: Money.of(String(form.grossAmount || 0)), frequency: form.frequency }];
  const annualGross = new MoneyDecimal(annualizeIncome(incomeSources).toString());

  const dials: DialInput[] = form.contributions
    .filter((c) => c.enabled && (c.mode === "amount" ? c.amount > 0 : c.percent > 0))
    .map((c, i) => {
      // A fixed dollar amount (gross-base only) becomes an equivalent % of annual
      // gross so the rest of the engine stays percentage-based.
      const pct =
        c.mode === "amount" && c.base === "gross"
          ? annualGross.gt(0)
            ? new MoneyDecimal(c.amount).div(annualGross).toString()
            : "0"
          : frac(c.percent);
      const dial: DialInput = { bucket: c.bucket, base: c.base, pct, priority: i + 1 };
      if (c.cap && Number(c.cap) > 0) dial.annualCap = Money.of(c.cap);
      return dial;
    });

  return {
    incomeSources,
    annualExpenses: Money.of(String(form.annualExpenses || 0)),
    annualBenefitPremiums: Money.of(new MoneyDecimal(form.benefitPremiumsMonthly || 0).mul(12).toString()),
    taxProfile: { filingStatus: form.filingStatus, state: form.state.toUpperCase(), taxYear: 2026 },
    plan: {
      currentBalance: Money.of(String(form.currentBalance || 0)),
      // Fall back to sensible defaults when a rate field is left blank — a 0 SWR
      // would divide the FI number by zero.
      swr: frac(form.swrPercent ?? 4),
      realReturn: frac(form.realReturnPercent ?? 5),
      inflation: frac(form.inflationPct ?? 2.5),
      employerMatchPercent: frac(form.employerMatchPercent || 0),
      currentAge: Number(form.currentAge) || 0,
      targetRetireAge: Number(form.targetRetireAge) || 0,
    },
    dials,
  };
}

function defaultContribution(o: (typeof BUCKET_OPTIONS)[number]): ContributionForm {
  return {
    bucket: o.bucket,
    base: o.base,
    enabled: o.defaultEnabled ?? false,
    mode: "percent",
    percent: o.defaultPercent ?? 0,
    amount: 0,
    ...(o.cap ? { cap: o.cap } : {}),
  };
}

/**
 * Reconcile a loaded form with the current bucket catalog: keep the user's
 * values for buckets that still exist, add any newly-introduced ones with their
 * defaults, and drop retired ones. Also clears any legacy unitemized expense
 * lump so essentials come only from itemized bills.
 */
export function normalizeSetupForm(form: SetupForm): SetupForm {
  const byBucket = new Map(form.contributions.map((c) => [c.bucket, c]));
  return {
    ...form,
    annualExpenses: 0,
    // Fill fields introduced after the form was saved (F4 inflation; C2 calibre)
    // and backfill any rate a stored/imported form left null.
    swrPercent: form.swrPercent ?? 4,
    realReturnPercent: form.realReturnPercent ?? 5,
    inflationPct: form.inflationPct ?? 2.5,
    benefitPremiumsMonthly: form.benefitPremiumsMonthly ?? 0,
    calibre: form.calibre ?? defaultCalibre(),
    contributions: BUCKET_OPTIONS.map((o) => ({ ...defaultContribution(o), ...(byBucket.get(o.bucket) ?? {}) })),
  };
}
