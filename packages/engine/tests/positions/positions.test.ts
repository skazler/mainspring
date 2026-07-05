import Decimal from "decimal.js";
import { Money } from "@mainspring/schema";
import { describe, expect, it } from "vitest";
import {
  costBasis,
  isLongTerm,
  positionValue,
  realizeSale,
  unrealizedGain,
  type OpenLot,
} from "../../src/index";

// Two open lots of the same ticker, both held > 1 year as of the 2026 sale date.
const lotA = (): OpenLot => ({ id: "A", shares: new Decimal("10"), costBasis: Money.of("2000"), acquiredOn: "2024-01-15" });
const lotB = (): OpenLot => ({ id: "B", shares: new Decimal("10"), costBasis: Money.of("2500"), acquiredOn: "2024-06-15" });

describe("valuation", () => {
  it("position value and unrealized gain", () => {
    const value = positionValue("20", Money.of("300")); // 20 × $300
    expect(value.toString()).toBe("6000.0000");
    expect(unrealizedGain(value, Money.of("4500")).toString()).toBe("1500.0000");
  });

  it("cost basis is the sum of open lots", () => {
    expect(costBasis([lotA(), lotB()]).toString()).toBe("4500.0000");
  });
});

describe("holding period (long-term = held a year and a day)", () => {
  it("> 1 year is long-term", () => {
    expect(isLongTerm("2024-01-15", "2026-03-01")).toBe(true);
    expect(isLongTerm("2024-01-15", "2025-01-16")).toBe(true); // a year and a day
  });
  it("≤ 1 year is short-term", () => {
    expect(isLongTerm("2024-01-15", "2025-01-15")).toBe(false); // exactly one year
    expect(isLongTerm("2025-12-01", "2026-03-01")).toBe(false);
  });
  it("F23: a Feb-29 acquisition rolls to Mar-2 (documented, intended behavior)", () => {
    // Date.UTC(2025, 1, 30) has no Feb 30 → normalizes to Mar 2, 2025, so the
    // long-term threshold for a leap-day buy lands two days after the anniversary.
    expect(isLongTerm("2024-02-29", "2025-03-01")).toBe(false); // Mar 1 < threshold
    expect(isLongTerm("2024-02-29", "2025-03-02")).toBe(true); // Mar 2 = threshold
  });
});

describe("realizeSale", () => {
  it("FIFO disposes the oldest lot first", () => {
    const r = realizeSale(
      { shares: new Decimal("10"), pricePerShare: Money.of("300"), soldOn: "2026-03-01", method: "fifo" },
      [lotA(), lotB()],
    );
    expect(r.realized.longTerm.toString()).toBe("1000.0000"); // 3000 − 2000
    expect(r.realized.shortTerm.toString()).toBe("0.0000");
    expect(r.proceeds.toString()).toBe("3000.0000");
    expect(r.remainingLots).toHaveLength(1);
    expect(r.remainingLots[0]!.id).toBe("B");
  });

  it("specific-ID disposes the named lot", () => {
    const r = realizeSale(
      { shares: new Decimal("10"), pricePerShare: Money.of("300"), soldOn: "2026-03-01", method: "specific-id", specificLotId: "B" },
      [lotA(), lotB()],
    );
    expect(r.realized.longTerm.toString()).toBe("500.0000"); // 3000 − 2500
    expect(r.remainingLots.map((l) => l.id)).toEqual(["A"]);
  });

  it("F2: an oversized specific-ID sale throws instead of spilling into other lots", () => {
    expect(() =>
      realizeSale(
        { shares: new Decimal("15"), pricePerShare: Money.of("300"), soldOn: "2026-03-01", method: "specific-id", specificLotId: "B" },
        [lotA(), lotB()],
      ),
    ).toThrow(/specific lot B/);
  });

  it("partial sale allocates basis and fee pro-rata", () => {
    const r = realizeSale(
      { shares: new Decimal("5"), pricePerShare: Money.of("300"), fee: Money.of("10"), soldOn: "2026-03-01", method: "fifo" },
      [lotA(), lotB()],
    );
    // 5 of lot A: basis 2000·(5/10)=1000; proceeds 5·300=1500; less $10 fee → gain 490
    expect(r.realized.longTerm.toString()).toBe("490.0000");
    expect(r.proceeds.toString()).toBe("1490.0000");
    const a = r.remainingLots.find((l) => l.id === "A")!;
    expect(a.shares.toString()).toBe("5");
    expect(a.costBasis.toString()).toBe("1000.0000");
  });

  it("classifies a short-term sale", () => {
    const recent: OpenLot = { id: "C", shares: new Decimal("10"), costBasis: Money.of("2000"), acquiredOn: "2025-12-01" };
    const r = realizeSale(
      { shares: new Decimal("10"), pricePerShare: Money.of("250"), soldOn: "2026-03-01", method: "fifo" },
      [recent],
    );
    expect(r.realized.shortTerm.toString()).toBe("500.0000"); // 2500 − 2000
    expect(r.realized.longTerm.toString()).toBe("0.0000");
  });

  it("throws when there aren't enough shares", () => {
    expect(() =>
      realizeSale(
        { shares: new Decimal("100"), pricePerShare: Money.of("300"), soldOn: "2026-03-01", method: "fifo" },
        [lotA()],
      ),
    ).toThrow(/not enough/);
  });
});
