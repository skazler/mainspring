/**
 * Portfolio statistics for the Calibre (docs/CALIBRE_REGISTERS.md §2).
 *
 * Pure, `number`-based (these are return *rates*, not currency — same note as
 * stats.ts). Nothing here reads the DB; series/stats are passed in. The whole
 * point: portfolio σ falls below the weighted-average σ when correlations < 1,
 * and that diversification benefit becomes visible on the gauge.
 */

import { periodReturns } from "./stats";
import { assetClass, defaultCorrelation, type AssetClassId } from "./asset-classes";

const PERIODS_PER_YEAR = 252;
const WEIGHT_EPSILON = 1e-6;

export interface PricePoint {
  date: string;
  close: number;
}

/**
 * Intersect each asset's series on shared dates, then take period returns per
 * asset. Returns null if the shared history is thinner than `minObs`, so a thin
 * series can't masquerade as signal.
 */
export function alignedReturns(
  seriesByAsset: Record<string, readonly PricePoint[]>,
  minObs = PERIODS_PER_YEAR,
): Record<string, number[]> | null {
  const ids = Object.keys(seriesByAsset);
  if (ids.length === 0) return null;

  // Dates present in EVERY asset's series.
  const dateSets = ids.map((id) => new Set(seriesByAsset[id]!.map((p) => p.date)));
  let shared: string[] = [...dateSets[0]!];
  for (let i = 1; i < dateSets.length; i++) {
    const s = dateSets[i]!;
    shared = shared.filter((d) => s.has(d));
  }
  const dates = shared.sort();
  // Need > minObs closes to produce minObs returns.
  if (dates.length <= minObs) return null;

  const out: Record<string, number[]> = {};
  for (const id of ids) {
    const byDate = new Map(seriesByAsset[id]!.map((p) => [p.date, p.close]));
    const closes = dates.map((d) => byDate.get(d)!);
    out[id] = periodReturns(closes);
  }
  return out;
}

/**
 * Sample covariance matrix (n−1), annualized ×252. `returns` is one return series
 * per asset, all the same length, in a fixed order; the result is index-aligned to
 * that order.
 */
export function covarianceMatrix(returns: readonly (readonly number[])[]): number[][] {
  const k = returns.length;
  if (k === 0) return [];
  const n = returns[0]!.length;
  for (const r of returns) {
    if (r.length !== n) throw new RangeError("covarianceMatrix: all series must be the same length");
  }
  if (n < 2) throw new RangeError("covarianceMatrix: need at least 2 observations");

  const means = returns.map((r) => r.reduce((a, b) => a + b, 0) / n);
  const cov: number[][] = Array.from({ length: k }, () => new Array(k).fill(0));
  for (let i = 0; i < k; i++) {
    for (let j = i; j < k; j++) {
      let s = 0;
      for (let t = 0; t < n; t++) s += (returns[i]![t]! - means[i]!) * (returns[j]![t]! - means[j]!);
      const c = (s / (n - 1)) * PERIODS_PER_YEAR;
      cov[i]![j] = c;
      cov[j]![i] = c;
    }
  }
  return cov;
}

/**
 * Portfolio expected return and volatility. μ = Σ wᵢμᵢ; σ = √(wᵀΣw). Weights must
 * sum to 1 (the Calibre enforces this with the same constraint machinery as the
 * Plan dials); a set that doesn't is rejected.
 */
export function portfolioStats(
  weights: readonly number[],
  mus: readonly number[],
  cov: readonly (readonly number[])[],
): { mu: number; sigma: number } {
  const k = weights.length;
  if (mus.length !== k || cov.length !== k) {
    throw new RangeError("portfolioStats: weights, mus, and cov must be the same length");
  }
  const sum = weights.reduce((a, b) => a + b, 0);
  if (Math.abs(sum - 1) > WEIGHT_EPSILON) {
    throw new RangeError(`portfolioStats: weights must sum to 1 (got ${sum})`);
  }

  const mu = weights.reduce((acc, w, i) => acc + w * mus[i]!, 0);
  let variance = 0;
  for (let i = 0; i < k; i++) {
    for (let j = 0; j < k; j++) variance += weights[i]! * weights[j]! * cov[i]![j]!;
  }
  return { mu, sigma: Math.sqrt(Math.max(0, variance)) };
}

/** Assemble a covariance matrix from per-class σ and the documented default correlations (§2). */
export function assumedCovariance(ids: readonly AssetClassId[], sigmas: readonly number[]): number[][] {
  const k = ids.length;
  const cov: number[][] = Array.from({ length: k }, () => new Array(k).fill(0));
  for (let i = 0; i < k; i++) {
    for (let j = 0; j < k; j++) {
      cov[i]![j] = sigmas[i]! * sigmas[j]! * defaultCorrelation(ids[i]!, ids[j]!);
    }
  }
  return cov;
}

export interface BlendedClass {
  id: AssetClassId;
  mu: number;
  sigma: number;
  /** "historical" when the live series cleared the overlap bar, else "assumed". */
  source: "historical" | "assumed";
}

/**
 * Per class, use the live (already deflated to REAL by the caller) stats when a
 * series is present, else the documented fallback — and report which, so the UI
 * can badge "historical" vs "assumed" per slice.
 */
export function blendWithFallbacks(
  ids: readonly AssetClassId[],
  live: Record<string, { mu: number; sigma: number } | undefined>,
): BlendedClass[] {
  return ids.map((id) => {
    const l = live[id];
    if (l && Number.isFinite(l.mu) && Number.isFinite(l.sigma)) {
      return { id, mu: l.mu, sigma: l.sigma, source: "historical" as const };
    }
    const c = assetClass(id);
    return { id, mu: Number(c.fallbackMu), sigma: Number(c.fallbackSigma), source: "assumed" as const };
  });
}
