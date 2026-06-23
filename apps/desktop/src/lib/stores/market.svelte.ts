import { annualizedStats } from "@mainspring/engine";
import { fetchMarket } from "$lib/bridge/invoke";
import { loadCloses, saveBars } from "$lib/db";

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

  /** Recompute stats from whatever history is already cached locally. */
  async loadCached(): Promise<void> {
    const closes = await loadCloses(this.ticker);
    if (closes.length > 1) this.apply(closes);
  }

  /** Fetch fresh history, cache it, and re-derive μ/σ. */
  async refresh(): Promise<void> {
    this.loading = true;
    this.error = null;
    try {
      const bars = await fetchMarket(this.ticker);
      await saveBars(this.ticker, bars);
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
