import { describe, expect, it } from "vitest";
import { annualizedStats, mean, periodReturns, stdev, toRealReturn } from "../../src/index";

describe("periodReturns", () => {
  it("computes period-over-period simple returns", () => {
    const r = periodReturns([100, 110, 99]);
    expect(r).toHaveLength(2);
    expect(r[0]).toBeCloseTo(0.1, 10);
    expect(r[1]).toBeCloseTo(-0.1, 10);
  });
  it("skips non-positive previous prices and short series", () => {
    expect(periodReturns([100])).toEqual([]);
    expect(periodReturns([])).toEqual([]);
  });
});

describe("mean / stdev", () => {
  it("mean", () => {
    expect(mean([1, 2, 3, 4])).toBe(2.5);
    expect(mean([])).toBe(0);
  });
  it("sample stdev", () => {
    // sample stdev of [2,4,4,4,5,5,7,9] is 2.138...
    expect(stdev([2, 4, 4, 4, 5, 5, 7, 9])).toBeCloseTo(2.138, 3);
    expect(stdev([5])).toBe(0);
  });
});

describe("annualizedStats", () => {
  it("constant daily growth → that drift annualized, ~zero vol", () => {
    const closes = [100];
    for (let i = 0; i < 252; i++) closes.push(closes[closes.length - 1]! * 1.001);
    const s = annualizedStats(closes, 252);
    expect(s.mu).toBeCloseTo(1.001 ** 252 - 1, 6); // ≈ 0.2866
    expect(s.sigma).toBeCloseTo(0, 8);
    expect(s.samples).toBe(252);
  });

  it("empty/flat series yields zeros", () => {
    expect(annualizedStats([], 252)).toEqual({ mu: 0, sigma: 0, samples: 0 });
  });
});

describe("toRealReturn (F4)", () => {
  it("deflates a nominal return by inflation: (1+μ)/(1+i) − 1", () => {
    // 7% nominal at 2.5% inflation ≈ 4.39% real
    expect(toRealReturn(0.07, 0.025)).toBeCloseTo((1.07 / 1.025) - 1, 10);
    // zero inflation is a no-op
    expect(toRealReturn(0.06, 0)).toBeCloseTo(0.06, 12);
    // real < nominal whenever inflation is positive
    expect(toRealReturn(0.05, 0.03)).toBeLessThan(0.05);
  });
});
