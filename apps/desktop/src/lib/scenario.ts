import { ASSET_CLASSES, assumedCovariance, blendWithFallbacks, portfolioStats, recompute } from "@mainspring/engine";
import { buildProfileState, type SetupForm } from "./setup-map";

/** A saved plan: a named snapshot of the setup form (dials + assumptions). */
export interface Scenario {
  id: string;
  name: string;
  form: SetupForm;
  createdAt: string;
}

/** Comparable deterministic metrics for a scenario — the diff columns. */
export interface ScenarioSummary {
  takeHome: number;
  savingsRate: number;
  fiAge: number | null;
  fiNumber: number;
  /** Calibre portfolio μ/σ (documented-assumption stats, deterministic for the diff). */
  calibreMu: number;
  calibreSigma: number;
}

const IDS = ASSET_CLASSES.map((c) => c.id);

/** Portfolio μ/σ of a form's calibre from documented fallbacks (no async live data). */
function calibreStats(form: SetupForm): { mu: number; sigma: number } {
  const raw = IDS.map((id) => Number(form.calibre?.weights[id] ?? "0"));
  const total = raw.reduce((a, b) => a + b, 0);
  if (total <= 0) return { mu: 0, sigma: 0 };
  const w = raw.map((x) => x / total);
  const blended = blendWithFallbacks(IDS, {}); // all "assumed" → deterministic
  const cov = assumedCovariance(IDS, blended.map((b) => b.sigma));
  return portfolioStats(w, blended.map((b) => b.mu), cov);
}

/** Derive the comparison summary from a form. Pure (recompute is pure). */
export function scenarioSummary(form: SetupForm): ScenarioSummary {
  const v = recompute(buildProfileState(form));
  const c = calibreStats(form);
  return {
    takeHome: Number(v.net.toString()),
    savingsRate: Number(v.savingsRate),
    fiAge: v.fire.fiAge,
    fiNumber: Number(v.fire.fiNumber.toString()),
    calibreMu: c.mu,
    calibreSigma: c.sigma,
  };
}
