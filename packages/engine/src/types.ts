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
  currentAge: number;
  targetRetireAge: number;
}

export interface ProfileState {
  incomeSources: IncomeSourceInput[];
  dials: DialInput[];
  taxProfile: TaxProfileInput;
  /** Fixed/essential annual expenses. */
  annualExpenses: Money;
  /** Annualized variable/discretionary spending (from the spending tracker). Default 0. */
  variableAnnualSpending?: Money;
  /** Annualized savings-goal contributions (from the goals tracker). Default 0. */
  annualGoalContributions?: Money;
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
  net: Money;
  buckets: BucketAllocation[];
  /** Unallocated remainder per base. */
  leftover: Record<DialBase, Money>;
  /** annualExpenses + variable spending — drives the savings pool and FI number. */
  totalExpenses: Money;
  /** Annualized savings-goal contributions (claims the pool alongside dials). */
  goalContributions: Money;
  /** Where each gross dollar goes; slices sum to gross (for the proportions graph). */
  whereItGoes: { label: string; amount: Money }[];
  totalContributions: Money;
  /** totalContributions / net. */
  savingsRate: string;
  /** true if dial percentages on any shared base sum past 100%. */
  overAllocated: boolean;
  /** Deterministic FIRE metrics (FI number, time-to-FI, coast). */
  fire: FireMetrics;
}
