import { Money } from "@mainspring/schema";
import { describe, expect, it } from "vitest";
import {
  coastNumberFor,
  fiNumberFor,
  fireMetrics,
  projectBalances,
} from "../../src/index";

describe("projectBalances", () => {
  it("compounds balance + contribution year by year", () => {
    const s = projectBalances({
      currentBalance: Money.of("100000"),
      annualContribution: Money.of("30000"),
      realReturn: "0.05",
      years: 2,
    });
    expect(s[0]!.toString()).toBe("135000.0000"); // 100,000·1.05 + 30,000
    expect(s[1]!.toString()).toBe("171750.0000"); // 135,000·1.05 + 30,000
  });

  it("zero return is pure contribution", () => {
    const s = projectBalances({ currentBalance: Money.of("0"), annualContribution: Money.of("10000"), realReturn: "0", years: 3 });
    expect(s.map((m) => m.toString())).toEqual(["10000.0000", "20000.0000", "30000.0000"]);
  });
});

describe("FIRE metrics", () => {
  it("fiNumber = annualExpenses / swr", () => {
    expect(fiNumberFor(Money.of("40000"), "0.04").toString()).toBe("1000000.0000"); // ×25
    expect(fiNumberFor(Money.of("60000"), "0.035").toString()).toBe("1714285.7143");
  });

  it("flags already-FI when balance ≥ fiNumber", () => {
    const m = fireMetrics({
      currentBalance: Money.of("1200000"),
      annualContribution: Money.of("0"),
      annualExpenses: Money.of("40000"),
      swr: "0.04",
      realReturn: "0.05",
      currentAge: 45,
      targetRetireAge: 65,
    });
    expect(m.alreadyFI).toBe(true);
    expect(m.yearsToFI).toBe(0);
    expect(m.fiAge).toBe(45);
  });

  it("finds the first year balance reaches the FI number", () => {
    const m = fireMetrics({
      currentBalance: Money.of("100000"),
      annualContribution: Money.of("30000"),
      annualExpenses: Money.of("40000"),
      swr: "0.04",
      realReturn: "0.05",
      currentAge: 35,
      targetRetireAge: 65,
    });
    expect(m.fiNumber.toString()).toBe("1000000.0000");
    expect(m.alreadyFI).toBe(false);
    expect(m.yearsToFI).toBe(17);
    expect(m.fiAge).toBe(52);
  });

  it("returns null years-to-FI when unreachable in the horizon", () => {
    const m = fireMetrics({
      currentBalance: Money.of("0"),
      annualContribution: Money.of("100"),
      annualExpenses: Money.of("40000"),
      swr: "0.04",
      realReturn: "0",
      currentAge: 30,
      targetRetireAge: 65,
      horizonYears: 40,
    });
    expect(m.yearsToFI).toBeNull();
    expect(m.fiAge).toBeNull();
  });

  it("coast number discounts the FI number back to today", () => {
    // 30 years at 5% real: 1,000,000 / 1.05^30 ≈ 231,377
    const coast = coastNumberFor(Money.of("1000000"), "0.05", 35, 65);
    expect(coast.compare(Money.of("231000")) > 0).toBe(true);
    expect(coast.compare(Money.of("232000")) < 0).toBe(true);
    // with zero years left, coast == fiNumber
    expect(coastNumberFor(Money.of("1000000"), "0.05", 65, 65).toString()).toBe("1000000.0000");
  });
});
