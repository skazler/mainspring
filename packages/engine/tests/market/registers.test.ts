import Decimal from "decimal.js";
import { describe, expect, it } from "vitest";
import { Money } from "@mainspring/schema";
import {
  bucketHoldings,
  driftReport,
  estimateRebalanceTax,
  monthsToClose,
  realizeClassSell,
} from "../../src/index";
import type { OpenLot } from "../../src/positions/lots";
import type { TickerPosition } from "../../src/positions/ledger";

function position(ticker: string, shares: string, basis: string): TickerPosition {
  return {
    ticker,
    openLots: [{ id: ticker, shares: new Decimal(shares), costBasis: Money.of(basis), acquiredOn: "2020-01-01" }],
    openShares: new Decimal(shares),
    costBasis: Money.of(basis),
    realized: { shortTerm: Money.zero(), longTerm: Money.zero() },
  };
}

describe("bucketHoldings", () => {
  const positions = [position("VTI", "10", "1000"), position("VXUS", "10", "500"), position("BND", "10", "1000")];
  const price = (t: string): number | null => ({ VTI: 150, VXUS: 60, BND: 100 })[t] ?? null;
  const cls = (t: string) => ({ VTI: "us_total", VXUS: "intl_dev", BND: "bonds" })[t] as never;

  it("rolls tickers into class buckets at market value", () => {
    const { buckets, total } = bucketHoldings(positions, price, cls);
    expect(total).toBeCloseTo(1500 + 600 + 1000, 6); // 3100
    const us = buckets.find((b) => b.classId === "us_total")!;
    expect(us.value).toBeCloseTo(1500, 6);
    expect(us.estimated).toBe(false);
  });

  it("falls back to cost basis and flags estimated when no price is cached", () => {
    const { buckets } = bucketHoldings(positions, () => null, cls);
    const us = buckets.find((b) => b.classId === "us_total")!;
    expect(us.value).toBeCloseTo(1000, 6); // cost basis
    expect(us.estimated).toBe(true);
  });

  it("routes unmapped tickers to the unassigned bucket", () => {
    const { buckets } = bucketHoldings(positions, price, () => null);
    expect(buckets).toHaveLength(1);
    expect(buckets[0]!.classId).toBe("unassigned");
  });
});

describe("driftReport", () => {
  it("flags a class past the ±5pp threshold and surfaces missing targets", () => {
    // Held: 80% equity / 20% bonds. Target: 60/40.
    const buckets = [
      { classId: "us_total" as const, value: 800, tickers: ["VTI"], estimated: false },
      { classId: "bonds" as const, value: 200, tickers: ["BND"], estimated: false },
    ];
    const rows = driftReport(buckets, 1000, { us_total: 0.6, bonds: 0.3, intl_dev: 0.1 });
    const us = rows.find((r) => r.classId === "us_total")!;
    expect(us.driftPp).toBeCloseTo(20, 6); // 80% − 60%
    expect(us.drifted).toBe(true);
    // A target with no holding shows as an underweight zero-value row.
    const intl = rows.find((r) => r.classId === "intl_dev")!;
    expect(intl.value).toBe(0);
    expect(intl.driftPp).toBeCloseTo(-10, 6);
    expect(intl.drifted).toBe(true);
    // Sorted most-drifted first.
    expect(rows[0]!.classId).toBe("us_total");
  });
});

describe("monthsToClose", () => {
  it("ceils the flow needed and refuses without flow", () => {
    expect(monthsToClose(1000, 300)).toBe(4); // ceil(3.33)
    expect(monthsToClose(0, 300)).toBe(0);
    expect(monthsToClose(1000, 0)).toBeNull();
  });
});

describe("realizeClassSell", () => {
  it("spreads a target sale across tickers by market value, FIFO", () => {
    // Two tickers, both up. Sell $1000 worth across a $3000 class.
    const lots = [
      { ticker: "VTI", price: Money.of("150"), openLots: [{ id: "a", shares: new Decimal("10"), costBasis: Money.of("1000"), acquiredOn: "2020-01-01" }] as OpenLot[] },
      { ticker: "VXUS", price: Money.of("60"), openLots: [{ id: "b", shares: new Decimal("25"), costBasis: Money.of("1000"), acquiredOn: "2020-01-01" }] as OpenLot[] },
    ];
    const { proceeds, realized } = realizeClassSell(lots, Money.of("1000"), "2024-06-01");
    // Long-held → all long-term, no short-term.
    expect(Number(realized.shortTerm.toString())).toBeCloseTo(0, 6);
    expect(Number(proceeds.toString())).toBeGreaterThan(0);
    expect(Number(realized.longTerm.toString())).toBeGreaterThan(0);
  });
});

describe("estimateRebalanceTax", () => {
  it("golden: LT at 15%, ST at the marginal rate, no NIIT below threshold (single, 2026)", () => {
    // $20k LT gains stacked from $100k ordinary → all in the 15% band = $3,000.
    // $5k ST gains at a 22% marginal rate = $1,100. MAGI $100k < $200k → no NIIT.
    const r = estimateRebalanceTax({
      realized: { longTerm: Money.of("20000"), shortTerm: Money.of("5000") },
      ordinaryTaxableIncome: Money.of("100000"),
      modifiedAGI: Money.of("100000"),
      marginalOrdinaryRate: "0.22",
      filingStatus: "single",
      taxYear: 2026,
    });
    expect(r.longTermTax.toString()).toBe("3000.0000");
    expect(r.shortTermTax.toString()).toBe("1100.0000");
    expect(r.niit.toString()).toBe("0.0000");
    expect(r.total.toString()).toBe("4100.0000");
  });
});
