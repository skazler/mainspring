import { Money } from "@mainspring/schema";
import { describe, expect, it } from "vitest";
import { computeCapitalGainsTax, computeTax } from "../../src/index";

/**
 * Golden capital-gains scenarios — hand-verified, single filer in Texas, 2026.
 * LT brackets (single): 0% ≤49,450 · 15% ≤545,500 · 20% above.
 * NIIT: 3.8% on investment income over MAGI 200,000 (single).
 */

describe("capital gains via computeTax (single, TX, 2026)", () => {
  it("$100k wages + $10k LT gain → LT taxed at 15%, no NIIT", () => {
    const r = computeTax({
      grossWages: Money.of("100000"),
      pretax: Money.of("0"),
      filingStatus: "single",
      state: "TX",
      taxYear: 2026,
      longTermGains: Money.of("10000"),
    });
    // ordinary unchanged: taxable 83,900, federal 13,170, FICA 7,650
    expect(r.federal.toString()).toBe("13170.0000");
    expect(r.fica.toString()).toBe("7650.0000");
    expect(r.longTermCapGainsTax.toString()).toBe("1500.0000"); // 10,000 × 15%
    expect(r.niit.toString()).toBe("0.0000");
    expect(r.capitalGains.toString()).toBe("1500.0000");
    expect(r.total.toString()).toBe("22320.0000");
    expect(r.net.toString()).toBe("87680.0000"); // 110,000 − 22,320
    expect(r.effectiveRate).toBe("0.202909");
  });

  it("$40k wages + $40k LT gain → part fills the 0% bracket", () => {
    const r = computeTax({
      grossWages: Money.of("40000"),
      pretax: Money.of("0"),
      filingStatus: "single",
      state: "TX",
      taxYear: 2026,
      longTermGains: Money.of("40000"),
    });
    // ordinary taxable 23,900 → federal 2,620; FICA on 40k = 3,060
    expect(r.federal.toString()).toBe("2620.0000");
    expect(r.fica.toString()).toBe("3060.0000");
    // gain spans [23,900, 63,900]: 25,550 @ 0% + 14,450 @ 15% = 2,167.50
    expect(r.longTermCapGainsTax.toString()).toBe("2167.5000");
    expect(r.niit.toString()).toBe("0.0000");
    expect(r.total.toString()).toBe("7847.5000");
    expect(r.net.toString()).toBe("72152.5000");
  });

  it("$250k wages + $50k LT gain → 15% LT + NIIT 3.8%", () => {
    const r = computeTax({
      grossWages: Money.of("250000"),
      pretax: Money.of("0"),
      filingStatus: "single",
      state: "TX",
      taxYear: 2026,
      longTermGains: Money.of("50000"),
    });
    expect(r.federal.toString()).toBe("51304.0000");
    expect(r.fica.toString()).toBe("15514.0000");
    expect(r.longTermCapGainsTax.toString()).toBe("7500.0000"); // 50,000 × 15%
    // MAGI 300,000; over 200k = 100k; NII 50k → min = 50k × 3.8% = 1,900
    expect(r.niit.toString()).toBe("1900.0000");
    expect(r.capitalGains.toString()).toBe("9400.0000");
    expect(r.total.toString()).toBe("76218.0000");
    expect(r.net.toString()).toBe("223782.0000");
  });

  it("short-term gain is taxed as ordinary income (no preferential rate)", () => {
    const r = computeTax({
      grossWages: Money.of("100000"),
      pretax: Money.of("0"),
      filingStatus: "single",
      state: "TX",
      taxYear: 2026,
      shortTermGains: Money.of("10000"),
    });
    // taxable 93,900 → federal 15,370 (the extra 10k taxed at 22%)
    expect(r.taxableIncome.toString()).toBe("93900.0000");
    expect(r.federal.toString()).toBe("15370.0000");
    expect(r.longTermCapGainsTax.toString()).toBe("0.0000");
    expect(r.niit.toString()).toBe("0.0000");
    expect(r.total.toString()).toBe("23020.0000");
    expect(r.net.toString()).toBe("86980.0000");
  });
});

describe("computeCapitalGainsTax (module in isolation)", () => {
  it("stacks LT gains above ordinary income and applies NIIT over MAGI", () => {
    const r = computeCapitalGainsTax({
      ordinaryTaxableIncome: Money.of("233900"),
      longTermGains: Money.of("50000"),
      netInvestmentIncome: Money.of("50000"),
      modifiedAGI: Money.of("300000"),
      filingStatus: "single",
      taxYear: 2026,
    });
    expect(r.longTermTax.toString()).toBe("7500.0000");
    expect(r.niit.toString()).toBe("1900.0000");
    expect(r.total.toString()).toBe("9400.0000");
  });

  it("a net long-term loss yields no LT tax", () => {
    const r = computeCapitalGainsTax({
      ordinaryTaxableIncome: Money.of("83900"),
      longTermGains: Money.of("-5000"),
      netInvestmentIncome: Money.of("-5000"),
      modifiedAGI: Money.of("95000"),
      filingStatus: "single",
      taxYear: 2026,
    });
    expect(r.longTermTax.toString()).toBe("0.0000");
    expect(r.niit.toString()).toBe("0.0000");
  });
});
