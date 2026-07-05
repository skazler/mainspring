import { rollUpLots, type LedgerLot, type TickerPosition } from "@mainspring/engine";
import { Money } from "@mainspring/schema";
import { fetchMarket, runForecast, type Forecast } from "$lib/bridge/invoke";
import { deleteLot, loadCloses, loadLots, saveBars, saveLot, type LotRow } from "$lib/db";
import { annualizedStats, toRealReturn } from "@mainspring/engine";
import { profile } from "./profile.svelte";
import { FORECAST_SEED } from "$lib/forecast-seed";

function toLedger(row: LotRow): LedgerLot {
  return {
    id: row.id,
    ticker: row.ticker,
    side: row.side,
    shares: row.shares,
    pricePerShare: Money.of(row.price),
    fee: Money.of(row.fee),
    date: row.tradeDate,
    method: "fifo",
  };
}

/** The buy/sell lot ledger, persisted to the normalized `lots` table. */
class LotsStore {
  rows = $state<LotRow[]>([]);
  prices = $state<Record<string, number>>({});
  loading = $state(false);
  error = $state<string | null>(null);

  estimate = $state<{ ticker: string; forecast: Forecast; years: number } | null>(null);
  estimating = $state(false);

  /** Derived per-ticker positions (open lots + cost basis + realized gains). */
  get positions(): TickerPosition[] {
    return rollUpLots(this.rows.map(toLedger));
  }

  private tickers(): string[] {
    return [...new Set(this.rows.map((r) => r.ticker))];
  }

  async load(): Promise<void> {
    this.rows = await loadLots();
    for (const t of this.tickers()) {
      const closes = await loadCloses(t);
      if (closes.length) this.prices[t] = closes[closes.length - 1]!;
    }
  }

  async add(row: LotRow): Promise<void> {
    await saveLot(row);
    this.rows = await loadLots();
  }

  async remove(id: string): Promise<void> {
    await deleteLot(id);
    this.rows = await loadLots();
  }

  /** Fetch fresh history for each held ticker → cache → update latest price. */
  async refresh(): Promise<void> {
    this.loading = true;
    this.error = null;
    try {
      for (const t of this.tickers()) {
        const bars = await fetchMarket(t);
        await saveBars(t, bars);
        const last = bars[bars.length - 1];
        if (last) this.prices[t] = last.close;
      }
    } catch (e) {
      this.error = e instanceof Error ? e.message : String(e);
    } finally {
      this.loading = false;
    }
  }

  /** Project a ticker's open-position value forward from its historical trend. */
  async project(ticker: string, years = 20): Promise<void> {
    this.estimating = true;
    this.error = null;
    try {
      const closes = await loadCloses(ticker);
      if (closes.length < 2) {
        this.error = `No history for ${ticker} yet — refresh first.`;
        return;
      }
      const s = annualizedStats(closes, 252);
      // Historical μ is nominal; deflate to real to match the kernel's basis (F4).
      const inflation = Number(profile.plan.inflation ?? "0.025");
      const pos = this.positions.find((p) => p.ticker === ticker);
      const shares = pos ? Number(pos.openShares.toString()) : 0;
      const value = shares * (this.prices[ticker] ?? closes[closes.length - 1]!);
      const forecast = await runForecast({
        startBalance: value,
        annualContribution: 0,
        annualExpenses: 0,
        yearsAccumulation: years,
        yearsTotal: years,
        mu: toRealReturn(s.mu, inflation),
        sigma: s.sigma || 0.15,
        nPaths: 10_000,
        seed: FORECAST_SEED,
        model: "gbm",
      });
      this.estimate = { ticker, forecast, years };
    } catch (e) {
      this.error = e instanceof Error ? e.message : String(e);
    } finally {
      this.estimating = false;
    }
  }
}

export const lots = new LotsStore();
