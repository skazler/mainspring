export { recompute } from "./recompute";
export { annualizeIncome, PERIODS_PER_YEAR } from "./cashflow/annualize";
export { allocateBase } from "./allocation/allocate";
export type { BaseAllocation } from "./allocation/allocate";
export type {
  ProfileState,
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

// positions
export {
  positionValue,
  unrealizedGain,
  costBasis,
  openShares,
  realizeSale,
  isLongTerm,
} from "./positions";
export type { OpenLot, SaleInput, SaleResult, RealizedGains } from "./positions";
