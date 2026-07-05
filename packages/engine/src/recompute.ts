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

  // 4. Net-base dials draw straight from take-home.
  const netAlloc = allocateBase(net, "net", state.dials.filter((d) => d.base === "net"));

  // 5. Post-tax savings pool. Total expenses = fixed + recurring commitments +
  //    variable spending; goal contributions and auto-invest also claim the pool.
  const commitments = state.annualCommitments ?? Money.zero();
  const totalExpenses = state.annualExpenses
    .add(commitments)
    .add(state.variableAnnualSpending ?? Money.zero());
  const goalContributions = state.annualGoalContributions ?? Money.zero();
  // Recurring auto-invest (e.g. Acorns) is a contribution: it claims the pool
  // before dials, then folds back into total contributions below.
  const autoInvestments = state.annualInvestments ?? Money.zero();
  // F1: the pool is the real headroom left after everything already committed on
  // the gross and net bases. `net` (= gross − tax) still *contains* those dollars
  // — after-tax Roth AND pre-tax 401k/hsa/ira (the tax step lowers tax, not net) —
  // so leaving any of them in double-counts money that's already spent. Subtract
  // every prior claim. (D1 excludes pre-tax on the premise that `net` already
  // removed it; this engine's `net` does not, so they are subtracted here too —
  // otherwise the very double-count F1 targets reappears for 401k dials.)
  const priorClaims = [...grossAlloc.allocations, ...netAlloc.allocations].reduce(
    (sum, a) => sum.add(a.amount),
    Money.zero(),
  );
  const postTaxSavings = maxMoney(
    net.subtract(priorClaims).subtract(totalExpenses).subtract(goalContributions).subtract(autoInvestments),
    Money.zero(),
  );
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
  // Contributions from your own income (dials + auto-invest). Employer match is
  // free money on top — it grows net worth but isn't part of your paycheck, so
  // it stays out of the "where every dollar goes" breakdown.
  const ownContributions = buckets.reduce((sum, b) => sum.add(b.amount), autoInvestments);
  const employerMatch = state.plan.employerMatchPercent ? gross.multiply(state.plan.employerMatchPercent) : Money.zero();
  const totalContributions = ownContributions.add(employerMatch);

  // Where each gross dollar goes (slices sum to gross; leftover absorbs the rest).
  const whereItGoes: { label: string; amount: Money }[] = [
    { label: "Taxes", amount: tax.total },
    { label: "Investing", amount: ownContributions },
    { label: "Goals", amount: goalContributions },
    // Bills & essentials = the baseline living lump + itemized recurring bills.
    { label: "Bills & essentials", amount: state.annualExpenses.add(commitments) },
    { label: "Spending", amount: state.variableAnnualSpending ?? Money.zero() },
  ];
  const accounted = whereItGoes.reduce((sum, s) => sum.add(s.amount), Money.zero());
  whereItGoes.push({ label: "Leftover", amount: maxMoney(gross.subtract(accounted), Money.zero()) });
  // F12: how much the plan over-commits gross (0 when it fits). Leftover clamps at
  // 0 for the donut; the deficit is the mirror image, so the verdict and the
  // breakdown both derive from this one field instead of computing it twice.
  const deficit = maxMoney(accounted.subtract(gross), Money.zero());

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
    commitments,
    autoInvestments,
    goalContributions,
    whereItGoes,
    deficit,
    ownContributions,
    employerMatch,
    totalContributions,
    savingsRate: net.isZero() ? "0.000000" : ownContributions.ratioTo(net),
    overAllocated: grossAlloc.overAllocated || netAlloc.overAllocated || savingsAlloc.overAllocated,
    fire,
  };
}
