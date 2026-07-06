import { toRealReturn } from "@mainspring/engine";
import { runForecast, type Forecast, type SimParams } from "$lib/bridge/invoke";
import { profile } from "./profile.svelte";
import { view } from "./derived.svelte";
import { market } from "./market.svelte";
import { calibre } from "./calibre.svelte";
import { FORECAST_SEED } from "$lib/forecast-seed";

const num = (s: string) => Number(s);

/**
 * Monte Carlo forecast state. The deterministic view is instant; this is the
 * on-demand "how sure am I" run that crosses to the Rust kernel.
 */
class ForecastStore {
  result = $state<Forecast | null>(null);
  running = $state(false);
  error = $state<string | null>(null);

  async run(): Promise<void> {
    this.running = true;
    this.error = null;
    try {
      const yearsAccumulation = Math.max(0, profile.plan.targetRetireAge - profile.plan.currentAge);
      const params: SimParams = {
        startBalance: num(profile.plan.currentBalance.toString()),
        annualContribution: num(view.current.totalContributions.toString()),
        // Full itemized expenses (bills + variable), not a lump baseline.
        annualExpenses: num(view.current.totalExpenses.toString()),
        yearsAccumulation,
        yearsTotal: Math.max(yearsAccumulation + 1, 95 - profile.plan.currentAge),
        // μ/σ source order (C4): the applied Calibre's blended real stats →
        // single-ticker market store (legacy fallback, deflated) → the plain
        // realReturn assumption. The kernel runs in real dollars throughout.
        ...(() => {
          const cal = calibre.applied;
          if (cal.sigma > 0) return { mu: cal.mu, sigma: cal.sigma };
          if (market.mu !== null) {
            return { mu: toRealReturn(market.mu, Number(profile.plan.inflation ?? "0.025")), sigma: market.sigma ?? 0.15 };
          }
          return { mu: Number(profile.plan.realReturn), sigma: market.sigma ?? 0.15 };
        })(),
        nPaths: 10_000,
        seed: FORECAST_SEED,
        model: "gbm",
      };
      this.result = await runForecast(params);
    } catch (e) {
      this.error = e instanceof Error ? e.message : String(e);
    } finally {
      this.running = false;
    }
  }
}

export const forecast = new ForecastStore();
