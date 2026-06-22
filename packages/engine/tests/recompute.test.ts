import { Money } from "@mainspring/schema";
import { describe, expect, it } from "vitest";
import { recompute, type ProfileState } from "../src/index";

describe("recompute — income → pre-tax → tax → net → buckets", () => {
  it("caps pre-tax, feeds it to tax, then allocates the savings pool", () => {
    const state: ProfileState = {
      incomeSources: [{ grossAmount: Money.of("100000"), frequency: "annual" }],
      annualExpenses: Money.of("40000"),
      taxProfile: { filingStatus: "single", state: "TX", taxYear: 2026 },
      plan: { currentBalance: Money.of("100000"), swr: "0.04", realReturn: "0.05", currentAge: 35, targetRetireAge: 65 },
      dials: [
        // 50% of gross would be $50k, but the 401k cap clamps it to $24,500
        { bucket: "401k_pretax", base: "gross", pct: "0.5", priority: 1, annualCap: Money.of("24500") },
        // 20% of the post-tax savings pool (net − expenses)
        { bucket: "brokerage", base: "post_tax_savings", pct: "0.2", priority: 2 },
      ],
    };

    const r = recompute(state);

    expect(r.gross.toString()).toBe("100000.0000");
    expect(r.pretax.toString()).toBe("24500.0000"); // capped, then fed to tax

    // matches the Phase 2 golden for $100k w/ $24.5k pre-tax (single, TX)
    expect(r.tax.federal.toString()).toBe("7780.0000");
    expect(r.tax.total.toString()).toBe("15430.0000");
    expect(r.net.toString()).toBe("84570.0000");

    // savings pool = net − expenses = 44,570; brokerage = 20% = 8,914
    const k401 = r.buckets.find((b) => b.bucket === "401k_pretax")!;
    const brok = r.buckets.find((b) => b.bucket === "brokerage")!;
    expect(k401.amount.toString()).toBe("24500.0000");
    expect(k401.clampedByCap).toBe(true);
    expect(brok.amount.toString()).toBe("8914.0000");

    expect(r.leftover.gross.toString()).toBe("75500.0000");
    expect(r.leftover.post_tax_savings.toString()).toBe("35656.0000");

    expect(r.totalContributions.toString()).toBe("33414.0000");
    expect(r.savingsRate).toBe(Money.of("33414").ratioTo(Money.of("84570")));
    expect(r.overAllocated).toBe(false);
  });

  it("handles zero income without dividing by zero", () => {
    const r = recompute({
      incomeSources: [],
      annualExpenses: Money.of("40000"),
      taxProfile: { filingStatus: "single", state: "TX", taxYear: 2026 },
      plan: { currentBalance: Money.of("0"), swr: "0.04", realReturn: "0.05", currentAge: 35, targetRetireAge: 65 },
      dials: [{ bucket: "brokerage", base: "post_tax_savings", pct: "0.2", priority: 1 }],
    });
    expect(r.gross.isZero()).toBe(true);
    expect(r.net.isZero()).toBe(true);
    expect(r.totalContributions.isZero()).toBe(true);
    expect(r.savingsRate).toBe("0.000000");
  });
});
