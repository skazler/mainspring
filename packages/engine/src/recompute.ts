import { Money } from "@mainspring/schema";
import type { Bucket, DialBase } from "@mainspring/schema";
import { allocateBase } from "./allocation/allocate";
import { annualizeIncome } from "./cashflow/annualize";
import { fireMetrics } from "./fire/metrics";
import { maxMoney } from "./money-util";
import { computeTax } from "./tax/engine";
import type { ProfileState, RecomputeView } from "./types";

/**
 * Buckets whose contributions reduce taxable income before the bracket pass.
 * (The dial vocabulary uses "ira" for the deductible/traditional IRA; Roth flows
 * use roth_401k, which is not pre-tax.)
 */
const PRETAX_BUCKETS = new Set<Bucket>(["401k_pretax", "hsa", "ira"]);

/**
 * The single entry point the UI calls on every dial change. Pure and synchronous:
 * income → pre-tax → tax → net → bucket allocation. No I/O, no clock.
 */
export function recompute(state: ProfileState): RecomputeView {
  const gross = annualizeIncome(state.incomeSources);

  // 1. Gross-base dials (incl. pre-tax buckets) — independent of tax.
  const grossAlloc = allocateBase(
    gross,
    "gross",
    state.dials.filter((d) => d.base === "gross"),
  );

  // 2. Pre-tax total feeds the tax step (the allocation→tax feedback in MONEY_ENGINE §3).
  const pretax = grossAlloc.allocations
    .filter((a) => PRETAX_BUCKETS.has(a.bucket))
    .reduce((sum, a) => sum.add(a.amount), Money.zero());

  // 3. Tax → net.
  const tax = computeTax({
    grossWages: gross,
    pretax,
    filingStatus: state.taxProfile.filingStatus,
    state: state.taxProfile.state,
    taxYear: state.taxProfile.taxYear,
  });
  const net = tax.net;

  // 4. Net- and post-tax-savings-base dials. Total expenses = fixed + variable
  //    spending; the savings pool is take-home after all living expenses.
  const totalExpenses = state.annualExpenses.add(state.variableAnnualSpending ?? Money.zero());
  const postTaxSavings = maxMoney(net.subtract(totalExpenses), Money.zero());
  const netAlloc = allocateBase(net, "net", state.dials.filter((d) => d.base === "net"));
  const savingsAlloc = allocateBase(
    postTaxSavings,
    "post_tax_savings",
    state.dials.filter((d) => d.base === "post_tax_savings"),
  );

  const buckets = [...grossAlloc.allocations, ...netAlloc.allocations, ...savingsAlloc.allocations];
  const leftover: Record<DialBase, Money> = {
    gross: grossAlloc.leftover,
    net: netAlloc.leftover,
    post_tax_savings: savingsAlloc.leftover,
  };
  const totalContributions = buckets.reduce((sum, b) => sum.add(b.amount), Money.zero());

  const fire = fireMetrics({
    currentBalance: state.plan.currentBalance,
    annualContribution: totalContributions,
    annualExpenses: totalExpenses,
    swr: state.plan.swr,
    realReturn: state.plan.realReturn,
    currentAge: state.plan.currentAge,
    targetRetireAge: state.plan.targetRetireAge,
  });

  return {
    gross,
    pretax,
    tax,
    net,
    buckets,
    leftover,
    totalExpenses,
    totalContributions,
    savingsRate: net.isZero() ? "0.000000" : totalContributions.ratioTo(net),
    overAllocated: grossAlloc.overAllocated || netAlloc.overAllocated || savingsAlloc.overAllocated,
    fire,
  };
}
