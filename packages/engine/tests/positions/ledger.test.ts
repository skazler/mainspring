import { Money } from "@mainspring/schema";
import { describe, expect, it } from "vitest";
import { rollUpLots, type LedgerLot } from "../../src/index";

const buy = (id: string, ticker: string, shares: string, price: string, date: string): LedgerLot => ({
  id,
  ticker,
  side: "buy",
  shares,
  pricePerShare: Money.of(price),
  date,
});
const sell = (id: string, ticker: string, shares: string, price: string, date: string): LedgerLot => ({
  id,
  ticker,
  side: "sell",
  shares,
  pricePerShare: Money.of(price),
  date,
  method: "fifo",
});

describe("rollUpLots", () => {
  it("rolls buys into an open position with summed cost basis", () => {
    const [pos] = rollUpLots([
      buy("a", "VTI", "10", "200", "2024-01-15"),
      buy("b", "VTI", "10", "250", "2024-06-15"),
    ]);
    expect(pos!.ticker).toBe("VTI");
    expect(pos!.openShares.toString()).toBe("20");
    expect(pos!.costBasis.toString()).toBe("4500.0000");
    expect(pos!.realized.longTerm.toString()).toBe("0.0000");
  });

  it("applies a sell FIFO and records the realized long-term gain", () => {
    const [pos] = rollUpLots([
      buy("a", "VTI", "10", "200", "2024-01-15"),
      buy("b", "VTI", "10", "250", "2024-06-15"),
      sell("c", "VTI", "10", "300", "2026-03-01"), // disposes lot a (basis 2000)
    ]);
    expect(pos!.openShares.toString()).toBe("10"); // lot b remains
    expect(pos!.costBasis.toString()).toBe("2500.0000");
    expect(pos!.realized.longTerm.toString()).toBe("1000.0000"); // 3000 − 2000
  });

  it("groups multiple tickers independently", () => {
    const positions = rollUpLots([
      buy("a", "VTI", "5", "200", "2024-01-15"),
      buy("b", "AAPL", "3", "150", "2024-02-01"),
    ]);
    expect(positions.map((p) => p.ticker).sort()).toEqual(["AAPL", "VTI"]);
  });
});
