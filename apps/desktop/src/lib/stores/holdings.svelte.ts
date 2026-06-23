import { annualizedStats } from "@mainspring/engine";
import { fetchMarket, runForecast, type Forecast } from "$lib/bridge/invoke";
import { latestClose, loadCloses, loadHoldings, saveBars, saveHoldings } from "$lib/db";
import type { Holding } from "$lib/holdings";

/**
 * Holdings + per-holding trend estimations. Prices and μ/σ come from locally
 * cached history (fetched via the Rust core). Projections are explicitly
 * estimations from historical trends, not advice.
 */
class HoldingsStore {
  items = $state<Holding[]>([]);
  prices = $state<Record<string, number>>({});
  loading = $state(false);
  error = $state<string | null>(null);

  estimate = $state<{ ticker: string; forecast: Forecast; years: number } | null>(null);
  estimating = $state(false);

  private async persist() {
    await saveHoldings(this.items.map((h) => ({ ...h })));
  }

  private tickers(): string[] {
    return [...new Set(this.items.map((h) => h.ticker))];
  }

  async load(): Promise<void> {
    this.items = await loadHoldings();
    for (const t of this.tickers()) {
      const c = await latestClose(t);
      if (c != null) this.prices[t] = c;
    }
  }

  async add(h: Holding): Promise<void> {
    this.items.push(h);
    await this.persist();
  }

  async remove(index: number): Promise<void> {
    this.items.splice(index, 1);
    await this.persist();
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

  /** Project a single holding's value forward from its own historical trend. */
  async project(h: Holding, years = 20): Promise<void> {
    this.estimating = true;
    this.error = null;
    try {
      const closes = await loadCloses(h.ticker);
      if (closes.length < 2) {
        this.error = `No history for ${h.ticker} yet — refresh first.`;
        return;
      }
      const s = annualizedStats(closes, 252);
      const value = h.shares * (this.prices[h.ticker] ?? closes[closes.length - 1]!);
      const forecast = await runForecast({
        startBalance: value,
        annualContribution: 0,
        annualExpenses: 0,
        yearsAccumulation: years,
        yearsTotal: years,
        mu: s.mu,
        sigma: s.sigma || 0.15,
        nPaths: 10_000,
        seed: 42,
        model: "gbm",
      });
      this.estimate = { ticker: h.ticker, forecast, years };
    } catch (e) {
      this.error = e instanceof Error ? e.message : String(e);
    } finally {
      this.estimating = false;
    }
  }
}

export const holdings = new HoldingsStore();
