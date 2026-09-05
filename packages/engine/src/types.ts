import type { Money } from "@mainspring/schema";
import type { Bucket, DialBase, FilingStatus, Frequency } from "@mainspring/schema";
import type { TaxResult } from "./tax/engine";
import type { FireMetrics } from "./fire/metrics";

// ── engine inputs (clean value objects, not DB rows) ──────────────
export interface IncomeSourceInput {
  grossAmount: Money;
  frequency: Frequency;
}

export interface DialInput {
  bucket: Bucket;
  /** Fraction of `base` in [0,1], as a decimal string e.g. "0.15". */
  pct: string;
  base: DialBase; // gross | net | post_tax_savings
  /** Fill order — lower fills first; matters for caps and a shared pool. */
  priority: number;
  /** IRS limit, if the bucket is capped (401k/IRA/HSA). */
  annualCap?: Money;
}

export interface TaxProfileInput {
  filingStatus: FilingStatus;
  state: string;
  taxYear: number;
}

/** Assumptions + balances that drive the deterministic FIRE projection. */
export interface PlanInput {
  /** Total invested assets today. */
  currentBalance: Money;
  /** Safe withdrawal rate, e.g. "0.04". */
  swr: string;
  /** Assumed real return, e.g. "0.05". */
  realReturn: string;
  /** Assumed annual inflation, e.g. "0.025". Deflates nominal market μ (F4). Default 0.025. */
  inflation?: string;
  currentAge: number;
  targetRetireAge: number;
  /** Employer 401(k) match as a fraction of gross, e.g. "0.04" for 4%. Default 0. */
  employerMatchPercent?: string;
}

export interface ProfileState {
  incomeSources: IncomeSourceInput[];
  dials: DialInput[];
  taxProfile: TaxProfileInput;
  /** Fixed/essential annual expenses. */
  annualExpenses: Money;
  /** Annualized variable/discretionary spending (from the spending tracker). Default 0. */
  variableAnnualSpending?: Money;
  /**
   * Variable spending for the "where every dollar goes" breakdown, annual-scale.
   * Falls back to `variableAnnualSpending` when absent.
   *
   * Deliberately a second figure. The breakdown answers "where is THIS MONTH's
   * money going", so the UI passes this month's logged spending × 12: it resets
   * on the 1st and fills in as the month runs, matching the budget readout
   * beside it. `variableAnnualSpending` stays the trailing-30-day run-rate,
   * because the FI projection must not sawtooth every 1st (see annualize.ts).
   */
  breakdownAnnualSpending?: Money;
  /** Annualized recurring commitments — insurance, car, subscriptions, API costs. Default 0. */
  annualCommitments?: Money;
  /** Annualized recurring auto-invest contributions (e.g. $50/wk into Acorns). Default 0. */
  annualInvestments?: Money;
  /** Annualized savings-goal contributions (from the goals tracker). Default 0. */
  annualGoalContributions?: Money;
  /**
   * Annualized employer benefit premiums withheld from the paycheck — health,
   * dental, vision. Default 0. These never reach your bank account, so they are
   * subtracted from `cashTakeHome` but not from `net`.
   *
   * Not modelled as a Section 125 pre-tax deduction yet: real premiums usually
   * escape both income tax and FICA, so a plan carrying them pays slightly less
   * tax than this engine reports. Treating them as post-tax keeps `tax` exact
   * for the deferral-only case and errs conservative (understates cash) rather
   * than optimistic.
   */
  annualBenefitPremiums?: Money;
  plan: PlanInput;
}

// ── engine outputs ────────────────────────────────────────────────
export interface BucketAllocation {
  bucket: Bucket;
  base: DialBase;
  amount: Money;
  /** desired (pct × base) exceeded the IRS cap and was clamped down. */
  clampedByCap: boolean;
  /** the base pool ran dry before this dial's desired amount was met. */
  clampedByBase: boolean;
}

export interface RecomputeView {
  gross: Money;
  /** Pre-tax deferrals fed into the tax step (401k_pretax + hsa + ira). */
  pretax: Money;
  tax: TaxResult;
  /**
   * Gross less tax. NOT what lands in your bank account — payroll deferrals and
   * benefit premiums are still inside it (see `recompute` step 5). Drives the
   * savings pool and `savingsRate`; show `cashTakeHome` to a human instead.
   */
  net: Money;
  /** Payroll-withheld benefit premiums (health/dental/vision). */
  benefitPremiums: Money;
  /** Contributions withheld straight from the paycheck (401k/Roth 401k/HSA). */
  payrollContributions: Money;
  /**
   * What actually reaches your bank account: net − payroll contributions −
   * benefit premiums. This is the figure a human means by "take-home".
   */
  cashTakeHome: Money;
  buckets: BucketAllocation[];
  /** Unallocated remainder per base. */
  leftover: Record<DialBase, Money>;
  /** annualExpenses + recurring commitments + variable spending — drives the savings pool and FI number. */
  totalExpenses: Money;
  /** Annualized recurring commitments (bills). */
  commitments: Money;
  /** Annualized recurring auto-invest contributions (folded into totalContributions). */
  autoInvestments: Money;
  /** Annualized savings-goal contributions (claims the pool alongside dials). */
  goalContributions: Money;
  /** Where each gross dollar goes; slices sum to gross (for the proportions graph). */
  whereItGoes: { label: string; amount: Money }[];
  /** Amount the plan over-commits gross, else 0 (F12) — the mirror of clamped Leftover. */
  deficit: Money;
  /**
   * Annual room for discretionary spending: gross less taxes, contributions,
   * goals and bills. Excludes variable spending (it's the pot that spending is
   * drawn from) and may be negative when the fixed plan outruns income. Feeds
   * the monthly budget — see `monthlyBudget`.
   */
  discretionaryAllowance: Money;
  /** Contributions from your own income (dials + auto-invest), excluding match. */
  ownContributions: Money;
  /** Employer 401(k) match — free money on top of your own contributions. */
  employerMatch: Money;
  /** ownContributions + employerMatch — drives net worth and the FI projection. */
  totalContributions: Money;
  /** totalContributions / net. */
  savingsRate: string;
  /** true if dial percentages on any shared base sum past 100%. */
  overAllocated: boolean;
  /** Deterministic FIRE metrics (FI number, time-to-FI, coast). */
  fire: FireMetrics;
}
