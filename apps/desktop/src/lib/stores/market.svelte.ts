import { annualizedStats } from "@mainspring/engine";
import { fetchMarket } from "$lib/bridge/invoke";
import { loadCloses, loadRefTicker, saveBars, saveRefTicker } from "$lib/db";

/**
 * Market data: fetched via the Rust core, cached in PGlite, and reduced to the
 * μ/σ that drive the forecast. Everything downstream reads these local stats.
 */
class MarketStore {
  ticker = $state("VTI");
  mu = $state<number | null>(null);
  sigma = $state<number | null>(null);
  samples = $state(0);
  refreshedAt = $state<string | null>(null);
  loading = $state(false);
  error = $state<string | null>(null);

  private apply(closes: number[]) {
    const s = annualizedStats(closes, 252);
    this.mu = s.mu;
    this.sigma = s.sigma;
    this.samples = s.samples;
  }

  /** Restore the persisted reference ticker, then recompute stats from local cache. */
  async loadCached(): Promise<void> {
    const saved = await loadRefTicker();
    if (saved) this.ticker = saved;
    const closes = await loadCloses(this.ticker);
    if (closes.length > 1) this.apply(closes);
  }

  /** Fetch fresh history, cache it, persist the ticker, and re-derive μ/σ. */
  async refresh(): Promise<void> {
    this.loading = true;
    this.error = null;
    try {
      const bars = await fetchMarket(this.ticker);
      await saveBars(this.ticker, bars);
      await saveRefTicker(this.ticker.trim().toUpperCase());
      this.apply(bars.map((b) => b.close));
      this.refreshedAt = new Date().toISOString();
    } catch (e) {
      this.error = e instanceof Error ? e.message : String(e);
    } finally {
      this.loading = false;
    }
  }
}

export const market = new MarketStore();
