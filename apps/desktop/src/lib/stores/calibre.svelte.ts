import {
  ASSET_CLASSES,
  annualizedStats,
  assumedCovariance,
  blendWithFallbacks,
  portfolioStats,
  toRealReturn,
  type AssetClassId,
} from "@mainspring/engine";
import { loadCloses } from "$lib/db";
import { runForecast } from "$lib/bridge/invoke";
import { FORECAST_SEED } from "$lib/forecast-seed";
import { fullWeights, type Calibre } from "$lib/setup-map";
import { setupForm } from "./setup-form.svelte";
import { profile } from "./profile.svelte";
import { view } from "./derived.svelte";

const IDS = ASSET_CLASSES.map((c) => c.id);

export interface PortfolioStat {
  mu: number;
  sigma: number;
  /** μ − 1.28σ, the ~10th-percentile ("typical bad") annual real return. */
  badYear: number;
}

/**
 * The Calibre's working state: editable asset-class weights, live (real) per-class
 * stats from local history where available, and the portfolio μ/σ that fall out of
 * the mix. Turning a weight recomputes stats synchronously; the Monte-Carlo success
 * probability is debounced because it crosses IPC to the Rust kernel.
 */
class CalibreStore {
  /** Working weights in [0,1]; they share a 100% budget (can't exceed 1 by drag). */
  weights = $state<Record<AssetClassId, number>>(this.fromCalibre(setupForm.calibre));
  /** Per-class live REAL stats, keyed by class id, when local history clears the bar. */
  live = $state<Record<string, { mu: number; sigma: number }>>({});
  successWorking = $state<number | null>(null);
  successApplied = $state<number | null>(null);
  running = $state(false);
  private timer: ReturnType<typeof setTimeout> | undefined;

  private fromCalibre(c: Calibre): Record<AssetClassId, number> {
    const w = {} as Record<AssetClassId, number>;
    for (const id of IDS) w[id] = Number(c.weights[id] ?? "0");
    return w;
  }

  /** Best-effort: derive each class's real μ/σ from cached proxy-ticker history. */
  async loadHistory(): Promise<void> {
    const inflation = Number(profile.plan.inflation ?? "0.025");
    const next: Record<string, { mu: number; sigma: number }> = {};
    for (const c of ASSET_CLASSES) {
      if (!c.proxyTicker) continue;
      try {
        const closes = await loadCloses(c.proxyTicker);
        if (closes.length > 252) {
          const s = annualizedStats(closes, 252);
          next[c.id] = { mu: toRealReturn(s.mu, inflation), sigma: s.sigma };
        }
      } catch {
        /* no history — fall back to the documented assumption */
      }
    }
    this.live = next;
    this.scheduleSuccess();
  }

  /** Portfolio μ/σ for a given weight set: live-where-available μ/σ + documented-default correlations. */
  statsFor(weights: Record<AssetClassId, number>): PortfolioStat {
    const blended = blendWithFallbacks(IDS, this.live);
    const raw = IDS.map((id) => weights[id]);
    const total = raw.reduce((a, b) => a + b, 0);
    // Normalize so a partly-allocated mix still reads a meaningful μ/σ.
    const w = total > 0 ? raw.map((x) => x / total) : raw.map(() => 0);
    if (total <= 0) return { mu: 0, sigma: 0, badYear: 0 };
    const mus = blended.map((b) => b.mu);
    const sigmas = blended.map((b) => b.sigma);
    const cov = assumedCovariance(IDS, sigmas);
    const { mu, sigma } = portfolioStats(w, mus, cov);
    return { mu, sigma, badYear: mu - 1.28 * sigma };
  }

  get working(): PortfolioStat {
    return this.statsFor(this.weights);
  }
  get applied(): PortfolioStat {
    return this.statsFor(this.fromCalibre(setupForm.calibre));
  }
  get blended() {
    return blendWithFallbacks(IDS, this.live);
  }
  /** How much of the 100% budget is still unallocated. */
  get remaining(): number {
    return Math.max(0, 1 - IDS.reduce((a, id) => a + this.weights[id], 0));
  }

  /** Set one weight, clamped so the mix never exceeds 100% (shared budget). */
  setWeight(id: AssetClassId, proposed: number): void {
    const others = IDS.reduce((a, k) => (k === id ? a : a + this.weights[k]), 0);
    this.weights[id] = Math.max(0, Math.min(proposed, 1 - others));
    this.scheduleSuccess();
  }

  loadPreset(weights: Record<AssetClassId, string>): void {
    this.weights = this.fromCalibre({ name: "", weights });
    this.scheduleSuccess();
  }

  /** Start tuning from the currently-applied calibre (called when the tab opens). */
  resetToApplied(): void {
    this.weights = this.fromCalibre(setupForm.calibre);
    this.scheduleSuccess();
  }

  /** Normalize to sum 1 and write to the form (marks it dirty). */
  fit(name: string): void {
    const total = IDS.reduce((a, id) => a + this.weights[id], 0);
    const weights = fullWeights(
      Object.fromEntries(IDS.map((id) => [id, total > 0 ? String(this.weights[id] / total) : "0"])) as Record<
        AssetClassId,
        string
      >,
    );
    setupForm.calibre = { name: name.trim() || "Custom", weights };
  }

  /** Debounced Monte-Carlo success probability for the plan under each calibre. */
  private scheduleSuccess(): void {
    clearTimeout(this.timer);
    this.timer = setTimeout(() => void this.runSuccess(), 400);
  }

  private async runSuccess(): Promise<void> {
    const v = view.current;
    const startBalance = Number(profile.plan.currentBalance.toString());
    const annualContribution = Number(v.totalContributions.toString());
    const annualExpenses = Number(v.totalExpenses.toString());
    const yearsAccumulation = Math.max(0, profile.plan.targetRetireAge - profile.plan.currentAge);
    const yearsTotal = Math.max(yearsAccumulation + 1, 95 - profile.plan.currentAge);
    const base = { startBalance, annualContribution, annualExpenses, yearsAccumulation, yearsTotal, nPaths: 4000, seed: FORECAST_SEED, model: "gbm" as const };
    this.running = true;
    try {
      const w = this.working;
      const a = this.applied;
      const [rw, ra] = await Promise.all([
        runForecast({ ...base, mu: w.mu, sigma: w.sigma }),
        runForecast({ ...base, mu: a.mu, sigma: a.sigma }),
      ]);
      this.successWorking = rw.successProbability;
      this.successApplied = ra.successProbability;
    } catch {
      this.successWorking = null;
      this.successApplied = null;
    } finally {
      this.running = false;
    }
  }
}

export const calibre = new CalibreStore();
