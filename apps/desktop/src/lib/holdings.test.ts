import { describe, expect, it } from "vitest";
import { holdingGain, holdingValue, portfolioCostBasis, portfolioValue, type Holding } from "./holdings";

const vti = (): Holding => ({ ticker: "VTI", shares: 10, costBasis: 2000, acquiredOn: "2024-01-15" });
const aapl = (): Holding => ({ ticker: "AAPL", shares: 5, costBasis: 800, acquiredOn: "2023-06-01" });

describe("holding math", () => {
  it("value and gain at a price", () => {
    expect(holdingValue(vti(), 300)).toBe(3000);
    expect(holdingGain(vti(), 300)).toBe(1000); // 3000 − 2000
    expect(holdingGain(vti(), 150)).toBe(-500); // a loss
  });

  it("portfolio value sums only priced holdings; cost basis sums all", () => {
    const hs = [vti(), aapl()];
    const prices = { VTI: 300 }; // AAPL not yet priced
    expect(portfolioValue(hs, prices)).toBe(3000);
    expect(portfolioValue(hs, { VTI: 300, AAPL: 200 })).toBe(4000);
    expect(portfolioCostBasis(hs)).toBe(2800);
  });
});
