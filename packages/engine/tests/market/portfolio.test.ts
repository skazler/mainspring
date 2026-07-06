import fc from "fast-check";
import { describe, expect, it } from "vitest";
import {
  alignedReturns,
  assumedCovariance,
  blendWithFallbacks,
  covarianceMatrix,
  portfolioStats,
} from "../../src/index";

describe("covarianceMatrix", () => {
  it("2-asset golden: hand-computed sample covariance, annualized ×252", () => {
    // Two 3-observation return series.
    const a = [0.01, -0.02, 0.03];
    const b = [0.02, 0.0, -0.01];
    // means: a = 0.006666…, b = 0.003333…
    // var(a) = Σ(a-ā)²/(n-1) = (0.00001077…+0.00071111…+0.00054444…)/2 = 0.00063333…
    // → ×252 = 0.1596
    const cov = covarianceMatrix([a, b]);
    expect(cov[0]![0]!).toBeCloseTo(0.0006333333 * 252, 6);
    // cov(a,b) sample = Σ(a-ā)(b-b̄)/2 ; compute directly here as the oracle
    const n = 3;
    const ma = a.reduce((s, x) => s + x, 0) / n;
    const mb = b.reduce((s, x) => s + x, 0) / n;
    let s = 0;
    for (let t = 0; t < n; t++) s += (a[t]! - ma) * (b[t]! - mb);
    expect(cov[0]![1]!).toBeCloseTo((s / (n - 1)) * 252, 10);
    expect(cov[0]![1]!).toBe(cov[1]![0]!); // symmetric
  });

  it("rejects unequal-length series and <2 observations", () => {
    expect(() => covarianceMatrix([[0.1, 0.2], [0.1]])).toThrow(RangeError);
    expect(() => covarianceMatrix([[0.1]])).toThrow(RangeError);
  });
});

describe("portfolioStats", () => {
  it("rejects weights that don't sum to 1", () => {
    expect(() => portfolioStats([0.5, 0.4], [0.05, 0.03], [[0.04, 0], [0, 0.01]])).toThrow(RangeError);
  });

  it("perfectly correlated assets give exactly the weighted-average σ", () => {
    // cov with correlation 1: cov[i][j] = σi·σj. Then σ_portfolio = Σ wᵢσᵢ.
    const s = [0.2, 0.1];
    const cov = [
      [s[0]! * s[0]!, s[0]! * s[1]!],
      [s[1]! * s[0]!, s[1]! * s[1]!],
    ];
    const w = [0.3, 0.7];
    const { sigma } = portfolioStats(w, [0.06, 0.02], cov);
    expect(sigma).toBeCloseTo(w[0]! * s[0]! + w[1]! * s[1]!, 12);
  });

  it("diversification: uncorrelated assets are calmer than the weighted average", () => {
    const cov = [
      [0.04, 0],
      [0, 0.01],
    ]; // σ = 0.2, 0.1, corr 0
    const w = [0.5, 0.5];
    const { sigma } = portfolioStats(w, [0.05, 0.02], cov);
    const weightedAvg = 0.5 * 0.2 + 0.5 * 0.1;
    expect(sigma).toBeLessThan(weightedAvg);
  });

  it("property (fast-check): σ_portfolio ≤ Σ wᵢσᵢ for any PSD cov and valid weights", () => {
    fc.assert(
      fc.property(
        // a k×k matrix A → Σ = AAᵀ is always PSD
        fc.integer({ min: 2, max: 5 }).chain((k) =>
          fc.record({
            a: fc.array(fc.array(fc.double({ min: -2, max: 2, noNaN: true }), { minLength: k, maxLength: k }), {
              minLength: k,
              maxLength: k,
            }),
            raw: fc.array(fc.double({ min: 0.0001, max: 1, noNaN: true }), { minLength: k, maxLength: k }),
          }),
        ),
        ({ a, raw }) => {
          const k = a.length;
          // Σ = A Aᵀ (PSD)
          const cov: number[][] = Array.from({ length: k }, () => new Array(k).fill(0));
          for (let i = 0; i < k; i++)
            for (let j = 0; j < k; j++) for (let t = 0; t < k; t++) cov[i]![j]! += a[i]![t]! * a[j]![t]!;
          const total = raw.reduce((s, x) => s + x, 0);
          const w = raw.map((x) => x / total); // sums to 1, non-negative
          const mus = new Array(k).fill(0.05);
          const { sigma } = portfolioStats(w, mus, cov);
          const weightedSigma = w.reduce((s, wi, i) => s + wi * Math.sqrt(cov[i]![i]!), 0);
          expect(sigma).toBeLessThanOrEqual(weightedSigma + 1e-9);
        },
      ),
      { numRuns: 300 },
    );
  });
});

describe("alignedReturns", () => {
  it("intersects on shared dates and refuses thin overlap", () => {
    const mk = (n: number, base: number) =>
      Array.from({ length: n }, (_, i) => ({ date: `2020-01-${String(i + 1).padStart(2, "0")}`, close: base + i }));
    // 5 shared closes with minObs 10 → null (too thin)
    expect(alignedReturns({ a: mk(5, 100), b: mk(5, 50) }, 10)).toBeNull();
    // Enough overlap → returns per-asset return series of length (shared − 1)
    const out = alignedReturns({ a: mk(300, 100), b: mk(300, 50) }, 252);
    expect(out).not.toBeNull();
    expect(out!.a).toHaveLength(299);
    expect(out!.b).toHaveLength(299);
  });
});

describe("blendWithFallbacks (badging)", () => {
  it("uses live stats where present, documented fallbacks otherwise", () => {
    const blended = blendWithFallbacks(["us_total", "bonds", "cash"], {
      us_total: { mu: 0.06, sigma: 0.17 },
      // bonds & cash missing → fallback
    });
    const byId = Object.fromEntries(blended.map((b) => [b.id, b]));
    expect(byId.us_total!.source).toBe("historical");
    expect(byId.us_total!.mu).toBe(0.06);
    expect(byId.bonds!.source).toBe("assumed");
    expect(byId.bonds!.mu).toBe(0.01); // fallbackMu for bonds
    expect(byId.cash!.source).toBe("assumed");
  });

  it("treats non-finite live stats as missing (fallback)", () => {
    const [b] = blendWithFallbacks(["reits"], { reits: { mu: NaN, sigma: 0.19 } });
    expect(b!.source).toBe("assumed");
  });
});

describe("assumedCovariance", () => {
  it("diagonal is variance; equity/bond off-diagonal is zero", () => {
    const cov = assumedCovariance(["us_total", "bonds"], [0.16, 0.05]);
    expect(cov[0]![0]!).toBeCloseTo(0.16 * 0.16, 12);
    expect(cov[0]![1]!).toBe(0); // equity↔bond default correlation 0
  });
});
