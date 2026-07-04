export { recompute } from "./recompute";
export { annualizeIncome, PERIODS_PER_YEAR } from "./cashflow/annualize";
export { allocateBase } from "./allocation/allocate";
export type { BaseAllocation } from "./allocation/allocate";
export { remainingPct, constrainPct } from "./allocation/constraints";
export {
  projectBalances,
  fireMetrics,
  fiNumberFor,
  coastNumberFor,
} from "./fire";
export type { ProjectionInput, FireInput, FireMetrics } from "./fire";
export type {
  ProfileState,
  PlanInput,
  DialInput,
  IncomeSourceInput,
  TaxProfileInput,
  BucketAllocation,
  RecomputeView,
} from "./types";

export { computeTax } from "./tax/engine";
export type { TaxInput, TaxResult } from "./tax/engine";
export { applyBrackets, marginalBracketRate } from "./tax/brackets";
export type { Bracket } from "./tax/brackets";
export { computeFica } from "./tax/fica";
export type { FicaBreakdown } from "./tax/fica";
export { computeStateTax, stateMarginalRate } from "./tax/state";
export { computeCapitalGainsTax } from "./tax/capgains";
export type { CapitalGainsInput, CapitalGainsResult } from "./tax/capgains";
export { getTaxConstants, supportedTaxYears } from "./tax/constants";
export type { TaxConstants, FicaConstants, NiitConstants } from "./tax/constants";
export { minMoney, maxMoney, addRates } from "./money-util";

// market
export { periodReturns, mean, stdev, annualizedStats } from "./market/stats";
export type { MarketStats } from "./market/stats";

// positions
export {
  positionValue,
  unrealizedGain,
  costBasis,
  openShares,
  realizeSale,
  isLongTerm,
  rollUpLots,
} from "./positions";
export type { OpenLot, SaleInput, SaleResult, RealizedGains, LedgerLot, TickerPosition } from "./positions";

// spending
export { annualizeSpending, annualizeMonth, monthTotal, spendingByCategory } from "./spending/annualize";
export type { SpendingEntry } from "./spending/annualize";

// savings goals
export { goalStatus, monthsBetween } from "./goals/goals";
export type { GoalInput, GoalStatus } from "./goals/goals";

// recurring commitments (bills) & auto-invest contributions
export { annualizeRecurring, annualizeItem, recurringByCategory } from "./recurring/recurring";
export type { RecurringItem, Cadence, RecurringKind } from "./recurring/recurring";

// AI assistant
export { applyDialAdjustments } from "./copilot";
