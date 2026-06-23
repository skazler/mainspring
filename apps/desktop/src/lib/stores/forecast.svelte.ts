import { runForecast, type Forecast, type SimParams } from "$lib/bridge/invoke";
import { profile } from "./profile.svelte";
import { view } from "./derived.svelte";
import { market } from "./market.svelte";

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
        annualExpenses: num(profile.annualExpenses.toString()),
        yearsAccumulation,
        yearsTotal: Math.max(yearsAccumulation + 1, 95 - profile.plan.currentAge),
        // Prefer μ/σ derived from local market history; fall back to the assumption.
        mu: market.mu ?? Number(profile.plan.realReturn),
        sigma: market.sigma ?? 0.15,
        nPaths: 10_000,
        seed: 42,
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
