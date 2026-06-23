/**
 * Derive the simulator's μ (drift) and σ (volatility) from a stored price series.
 *
 * These are statistical estimates feeding a probabilistic model — plain `number`
 * math, not `Money` (they're return rates, not currency). The simulator reads
 * these from *local* history; it never live-hits an API mid-run.
 */

export interface MarketStats {
  /** Annualized mean return. */
  mu: number;
  /** Annualized volatility. */
  sigma: number;
  /** Number of return observations the estimate is based on. */
  samples: number;
}

/** Period-over-period simple returns: r[i] = close[i]/close[i-1] − 1. */
export function periodReturns(closes: readonly number[]): number[] {
  const out: number[] = [];
  for (let i = 1; i < closes.length; i++) {
    const prev = closes[i - 1]!;
    if (prev > 0) out.push(closes[i]! / prev - 1);
  }
  return out;
}

export function mean(xs: readonly number[]): number {
  if (xs.length === 0) return 0;
  return xs.reduce((a, b) => a + b, 0) / xs.length;
}

/** Sample standard deviation (n−1). */
export function stdev(xs: readonly number[]): number {
  if (xs.length < 2) return 0;
  const m = mean(xs);
  const variance = xs.reduce((a, b) => a + (b - m) ** 2, 0) / (xs.length - 1);
  return Math.sqrt(variance);
}

/**
 * Annualized stats from a price series. `periodsPerYear`: 252 (daily), 12
 * (monthly), 1 (annual). μ compounds the mean period return; σ scales by √periods.
 * Note: this is a *nominal* historical estimate — inflation-adjustment to a real
 * return is a refinement for later.
 */
export function annualizedStats(closes: readonly number[], periodsPerYear = 252): MarketStats {
  const r = periodReturns(closes);
  if (r.length === 0) return { mu: 0, sigma: 0, samples: 0 };
  const mu = (1 + mean(r)) ** periodsPerYear - 1;
  const sigma = stdev(r) * Math.sqrt(periodsPerYear);
  return { mu, sigma, samples: r.length };
}
