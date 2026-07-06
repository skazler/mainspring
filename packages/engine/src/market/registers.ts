/**
 * The Registers (docs/CALIBRE_REGISTERS.md §2): the lot ledger regrouped by the
 * Calibre's asset classes, so you can see how the portfolio you actually hold has
 * drifted from the mix you designed — and what closing the gap costs.
 *
 * Pure and framework-free. It meshes three things that already exist: the lot
 * ledger (positions), the capital-gains engine, and the tax context from the
 * recompute view. This is a modeling instrument, not advice: it reports drift,
 * a contribution path, and a to-the-cent tax estimate for a sell — never a
 * "you should."
 */

import Decimal from "decimal.js";
import { Money } from "@mainspring/schema";
import type { FilingStatus } from "@mainspring/schema";
import { maxMoney } from "../money-util";
import { computeCapitalGainsTax } from "../tax/capgains";
import { realizeSale, type OpenLot, type RealizedGains } from "../positions/lots";
import type { TickerPosition } from "../positions/ledger";
import type { AssetClassId } from "./asset-classes";

/** Above this absolute per-class gap (percentage points), a class is flagged drifted. */
export const DRIFT_THRESHOLD_PP = 5;

const NONE = "unassigned" as const;
export type ClassKey = AssetClassId | typeof NONE;

/** One asset-class bucket of current holdings, valued at live price where known. */
export interface ClassBucket {
  classId: ClassKey;
  /** Market value of open shares (live price; cost basis where no price is cached). */
  value: number;
  tickers: string[];
  /** True if any ticker in the bucket was valued at cost basis (no live price yet). */
  estimated: boolean;
}

export interface DriftRow extends ClassBucket {
  /** Weight of the whole portfolio, 0..1. */
  actual: number;
  /** Calibre target weight, 0..1. */
  target: number;
  /** (actual − target) in percentage points; positive = overweight. */
  driftPp: number;
  drifted: boolean;
}

/**
 * Fold per-ticker positions into asset-class buckets at current value. A ticker
 * with no class mapping lands in the "unassigned" bucket (the UI prompts for a
 * one-time class pick). Value falls back to cost basis when no price is cached,
 * flagged `estimated` so the reader knows the drift is provisional.
 */
export function bucketHoldings(
  positions: readonly TickerPosition[],
  priceOf: (ticker: string) => number | null,
  classOf: (ticker: string) => AssetClassId | null,
): { buckets: ClassBucket[]; total: number } {
  const map = new Map<ClassKey, ClassBucket>();
  for (const p of positions) {
    const shares = Number(p.openShares.toString());
    if (shares <= 0) continue;
    const price = priceOf(p.ticker);
    const basis = Number(p.costBasis.toString());
    const value = price == null ? basis : shares * price;
    const key: ClassKey = classOf(p.ticker) ?? NONE;
    const b = map.get(key) ?? { classId: key, value: 0, tickers: [], estimated: false };
    b.value += value;
    b.tickers.push(p.ticker);
    if (price == null) b.estimated = true;
    map.set(key, b);
  }
  const buckets = [...map.values()].sort((a, b) => b.value - a.value);
  const total = buckets.reduce((s, b) => s + b.value, 0);
  return { buckets, total };
}

/**
 * Compare each bucket's actual weight against its Calibre target and flag drift.
 * Target classes with a weight but no current holding surface as a zero-value
 * row (underweight), so the reader sees what's missing, not just what's held.
 */
export function driftReport(
  buckets: readonly ClassBucket[],
  total: number,
  targets: Partial<Record<AssetClassId, number>>,
  thresholdPp = DRIFT_THRESHOLD_PP,
): DriftRow[] {
  const held = new Map(buckets.map((b) => [b.classId, b]));
  const keys = new Set<ClassKey>([...held.keys()]);
  for (const id of Object.keys(targets) as AssetClassId[]) {
    if ((targets[id] ?? 0) > 0) keys.add(id);
  }
  const rows: DriftRow[] = [];
  for (const key of keys) {
    const b = held.get(key) ?? { classId: key, value: 0, tickers: [], estimated: false };
    const actual = total > 0 ? b.value / total : 0;
    const target = key === NONE ? 0 : (targets[key] ?? 0);
    const driftPp = (actual - target) * 100;
    rows.push({ ...b, actual, target, driftPp, drifted: Math.abs(driftPp) >= thresholdPp });
  }
  // Most-drifted first; unassigned always shows (any holding there is off-plan).
  return rows.sort((a, b) => Math.abs(b.driftPp) - Math.abs(a.driftPp));
}

/**
 * A first-order estimate of how many months of `monthlyFlow`, directed entirely
 * at an underweight class, close a `gapDollars` shortfall. Deliberately simple:
 * it ignores that new contributions also grow the denominator, so it slightly
 * *over*-states the months — a conservative planning number, not a schedule.
 * Returns null when there's no flow to direct.
 */
export function monthsToClose(gapDollars: number, monthlyFlow: number): number | null {
  if (gapDollars <= 0) return 0;
  if (monthlyFlow <= 0) return null;
  return Math.ceil(gapDollars / monthlyFlow);
}

/** Per-ticker open lots + current price, for a rebalance sell dry-run. */
export interface TickerLots {
  ticker: string;
  /** Current price per share. */
  price: Money;
  openLots: readonly OpenLot[];
}

/**
 * Dry-run a sale of `targetProceeds` worth of a class, spread across its tickers
 * in proportion to each ticker's market value, oldest lots first (FIFO). Returns
 * the realized ST/LT gains and gross proceeds — no state is mutated. Tickers with
 * a zero/absent price or no open shares are skipped.
 */
export function realizeClassSell(
  tickerLots: readonly TickerLots[],
  targetProceeds: Money,
  soldOn: string,
): { proceeds: Money; realized: RealizedGains } {
  const priced = tickerLots.filter((t) => {
    const shares = t.openLots.reduce((s, l) => s.plus(l.shares), new Decimal(0));
    return t.price.compare(Money.zero()) > 0 && shares.gt(0);
  });
  if (priced.length === 0 || targetProceeds.compare(Money.zero()) <= 0) {
    return { proceeds: Money.zero(), realized: { shortTerm: Money.zero(), longTerm: Money.zero() } };
  }

  // Split the target proceeds across tickers by market value (penny-exact).
  const values = priced.map((t) => {
    const shares = t.openLots.reduce((s, l) => s.plus(l.shares), new Decimal(0));
    return t.price.multiply(shares.toString());
  });
  const perTicker = targetProceeds.allocate(values.map((v) => v.toString()));

  let shortTerm = Money.zero();
  let longTerm = Money.zero();
  let proceeds = Money.zero();
  for (let i = 0; i < priced.length; i++) {
    const t = priced[i]!;
    const want = perTicker[i]!;
    const openShares = t.openLots.reduce((s, l) => s.plus(l.shares), new Decimal(0));
    // Shares to reach the target proceeds for this ticker, capped at what's open.
    let shares = new Decimal(want.toString()).div(new Decimal(t.price.toString()));
    if (shares.gt(openShares)) shares = openShares;
    if (shares.lte(0)) continue;
    const sale = realizeSale(
      { shares, pricePerShare: t.price, soldOn, method: "fifo" },
      t.openLots,
    );
    shortTerm = shortTerm.add(sale.realized.shortTerm);
    longTerm = longTerm.add(sale.realized.longTerm);
    proceeds = proceeds.add(sale.proceeds);
  }
  return { proceeds, realized: { shortTerm, longTerm } };
}

export interface RebalanceTaxInput {
  realized: RealizedGains;
  /** Ordinary taxable income (the stacking point for LT gains) — from recompute. */
  ordinaryTaxableIncome: Money;
  modifiedAGI: Money;
  /** Marginal ordinary rate applied to short-term gains (they tax as income). */
  marginalOrdinaryRate: string;
  filingStatus: FilingStatus;
  taxYear: number;
}

export interface RebalanceTaxResult {
  /** Long-term gains taxed at the stacked 0/15/20% preferential rates. */
  longTermTax: Money;
  /** Short-term gains taxed at the marginal ordinary rate. */
  shortTermTax: Money;
  /** 3.8% net investment income tax over the MAGI threshold. */
  niit: Money;
  total: Money;
}

/**
 * The full tax cost of realizing `realized` gains in a rebalance: LT gains stacked
 * through the preferential brackets, ST gains at the marginal ordinary rate, plus
 * NIIT on the net investment income. A to-the-cent estimate, not tax advice.
 */
export function estimateRebalanceTax(input: RebalanceTaxInput): RebalanceTaxResult {
  const cg = computeCapitalGainsTax({
    ordinaryTaxableIncome: input.ordinaryTaxableIncome,
    longTermGains: input.realized.longTerm,
    netInvestmentIncome: input.realized.longTerm.add(input.realized.shortTerm),
    modifiedAGI: input.modifiedAGI,
    filingStatus: input.filingStatus,
    taxYear: input.taxYear,
  });
  const shortTermTax = maxMoney(input.realized.shortTerm, Money.zero()).multiply(input.marginalOrdinaryRate);
  return {
    longTermTax: cg.longTermTax,
    shortTermTax,
    niit: cg.niit,
    total: cg.total.add(shortTermTax),
  };
}
