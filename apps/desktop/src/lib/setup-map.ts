import { Money } from "@mainspring/schema";
import type { Bucket, DialBase, FilingStatus, Frequency } from "@mainspring/schema";
import type { DialInput, ProfileState } from "@mainspring/engine";
import { BUCKET_OPTIONS } from "./buckets";

export interface ContributionForm {
  bucket: Bucket;
  base: DialBase;
  enabled: boolean;
  /** Whole-number percent, e.g. 15 for 15%. */
  percent: number;
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
  /** Employer 401(k) match as a whole-number percent of gross, e.g. 4. */
  employerMatchPercent: number;
  contributions: ContributionForm[];
}

export function defaultSetupForm(): SetupForm {
  return {
    grossAmount: 105000,
    frequency: "annual",
    filingStatus: "single",
    state: "TX",
    currentAge: 32,
    targetRetireAge: 60,
    currentBalance: 150000,
    // No unitemized lump — essentials are itemized as bills in Outflows.
    annualExpenses: 0,
    swrPercent: 4,
    realReturnPercent: 5,
    employerMatchPercent: 0,
    contributions: BUCKET_OPTIONS.map((o) => ({
      bucket: o.bucket,
      base: o.base,
      enabled: o.defaultEnabled ?? false,
      percent: o.defaultPercent ?? 0,
      ...(o.cap ? { cap: o.cap } : {}),
    })),
  };
}

const frac = (percent: number): string => String(percent / 100);

/** Map the setup form to the engine's ProfileState. Pure. */
export function buildProfileState(form: SetupForm): ProfileState {
  const dials: DialInput[] = form.contributions
    .filter((c) => c.enabled && c.percent > 0)
    .map((c, i) => {
      const dial: DialInput = { bucket: c.bucket, base: c.base, pct: frac(c.percent), priority: i + 1 };
      if (c.cap && Number(c.cap) > 0) dial.annualCap = Money.of(c.cap);
      return dial;
    });

  return {
    incomeSources: [{ grossAmount: Money.of(String(form.grossAmount || 0)), frequency: form.frequency }],
    annualExpenses: Money.of(String(form.annualExpenses || 0)),
    taxProfile: { filingStatus: form.filingStatus, state: form.state.toUpperCase(), taxYear: 2026 },
    plan: {
      currentBalance: Money.of(String(form.currentBalance || 0)),
      swr: frac(form.swrPercent),
      realReturn: frac(form.realReturnPercent),
      employerMatchPercent: frac(form.employerMatchPercent || 0),
      currentAge: form.currentAge,
      targetRetireAge: form.targetRetireAge,
    },
    dials,
  };
}

function defaultContribution(o: (typeof BUCKET_OPTIONS)[number]): ContributionForm {
  return {
    bucket: o.bucket,
    base: o.base,
    enabled: o.defaultEnabled ?? false,
    percent: o.defaultPercent ?? 0,
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
    contributions: BUCKET_OPTIONS.map((o) => byBucket.get(o.bucket) ?? defaultContribution(o)),
  };
}
