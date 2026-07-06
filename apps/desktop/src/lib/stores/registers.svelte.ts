import {
  ASSET_CLASSES,
  bucketHoldings,
  driftReport,
  estimateRebalanceTax,
  monthsToClose,
  realizeClassSell,
  type AssetClassId,
  type DriftRow,
  type RebalanceTaxResult,
  type TickerLots,
} from "@mainspring/engine";
import { Money } from "@mainspring/schema";
import { loadTickerClasses, saveTickerClass } from "$lib/db";
import { lots } from "./lots.svelte";
import { setupForm } from "./setup-form.svelte";
import { view } from "./derived.svelte";
import { profile } from "./profile.svelte";

const IDS = ASSET_CLASSES.map((c) => c.id);

/** A costed plan for trimming an overweight class back to its target by selling. */
export interface SellPlan {
  sellDollars: number;
  proceeds: number;
  shortTermGain: number;
  longTermGain: number;
  tax: RebalanceTaxResult;
}

/**
 * The Registers: the lot ledger regrouped by the Calibre's asset classes, with
 * drift against the designed mix, a no-sell contribution path for underweights,
 * and a tax-costed sell dry-run for overweights. Reads live positions/prices from
 * the lots store and the tax context from the recompute view — nothing new to
 * persist except the one-time ticker → class map.
 */
class RegistersStore {
  /** ticker → class id, persisted (the one-time pick per held ticker). */
  classes = $state<Record<string, string>>({});

  async load(): Promise<void> {
    this.classes = await loadTickerClasses();
  }

  async setClass(ticker: string, classId: AssetClassId): Promise<void> {
    await saveTickerClass(ticker, classId);
    this.classes = { ...this.classes, [ticker]: classId };
  }

  private classOf = (ticker: string): AssetClassId | null =>
    (this.classes[ticker] as AssetClassId | undefined) ?? null;

  private priceOf = (ticker: string): number | null => lots.prices[ticker] ?? null;

  /** Applied Calibre target weights, normalized to sum 1. */
  get targets(): Partial<Record<AssetClassId, number>> {
    const w = setupForm.calibre.weights;
    const raw = IDS.map((id) => Number(w[id] ?? "0"));
    const total = raw.reduce((a, b) => a + b, 0);
    const out: Partial<Record<AssetClassId, number>> = {};
    if (total <= 0) return out;
    IDS.forEach((id, i) => {
      if (raw[i]! > 0) out[id] = raw[i]! / total;
    });
    return out;
  }

  /** Drift of held holdings vs. the designed mix. */
  get report(): { rows: DriftRow[]; total: number; estimated: boolean } {
    const { buckets, total } = bucketHoldings(lots.positions, this.priceOf, this.classOf);
    const rows = driftReport(buckets, total, this.targets);
    return { rows, total, estimated: buckets.some((b) => b.estimated) };
  }

  /** Held tickers with no class assigned yet — the UI prompts a one-time pick. */
  get unassigned(): string[] {
    return lots.positions
      .filter((p) => Number(p.openShares.toString()) > 0 && !this.classes[p.ticker])
      .map((p) => p.ticker);
  }

  /** Monthly investable flow (total annual contributions ÷ 12) for the no-sell path. */
  private get monthlyFlow(): number {
    return Number(view.current.totalContributions.toString()) / 12;
  }

  /** Months of contributions to lift an underweight class to target (null = no flow). */
  monthsToClose(row: DriftRow): number | null {
    const gap = Math.max(0, (row.target - row.actual) * this.report.total);
    return monthsToClose(gap, this.monthlyFlow);
  }

  /**
   * Cost trimming an overweight class back to target by selling — realized gains
   * plus a to-the-cent tax estimate. Returns null for a non-overweight class.
   */
  sellPlanFor(row: DriftRow): SellPlan | null {
    if (row.classId === "unassigned" || row.driftPp <= 0) return null;
    const total = this.report.total;
    const sellDollars = ((row.actual - row.target) * total).toFixed(4);
    if (Number(sellDollars) <= 0) return null;

    const tickerLots: TickerLots[] = lots.positions
      .filter((p) => this.classes[p.ticker] === row.classId && Number(p.openShares.toString()) > 0)
      .map((p) => ({
        ticker: p.ticker,
        price: Money.of(String(this.priceOf(p.ticker) ?? Number(p.costBasis.toString()) / Number(p.openShares.toString()))),
        openLots: p.openLots,
      }));

    const soldOn = new Date().toISOString().slice(0, 10);
    const { proceeds, realized } = realizeClassSell(tickerLots, Money.of(sellDollars), soldOn);
    const t = view.current.tax;
    const tax = estimateRebalanceTax({
      realized,
      ordinaryTaxableIncome: t.taxableIncome,
      // MAGI proxy: gross wages + realized gains (understates only true above-the-
      // line add-backs; a planning estimate, flagged as such in the UI).
      modifiedAGI: view.current.gross.add(realized.shortTerm).add(realized.longTerm),
      marginalOrdinaryRate: t.marginalRate,
      filingStatus: profile.taxProfile.filingStatus,
      taxYear: profile.taxProfile.taxYear,
    });
    return {
      sellDollars: Number(sellDollars),
      proceeds: Number(proceeds.toString()),
      shortTermGain: Number(realized.shortTerm.toString()),
      longTermGain: Number(realized.longTerm.toString()),
      tax,
    };
  }
}

export const registers = new RegistersStore();
