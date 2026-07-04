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

  it("variable spending raises total expenses, the FI number, and shrinks the savings pool", () => {
    const base: ProfileState = {
      incomeSources: [{ grossAmount: Money.of("120000"), frequency: "annual" }],
      annualExpenses: Money.of("40000"),
      taxProfile: { filingStatus: "single", state: "TX", taxYear: 2026 },
      plan: { currentBalance: Money.of("0"), swr: "0.04", realReturn: "0.05", currentAge: 35, targetRetireAge: 65 },
      dials: [{ bucket: "brokerage", base: "post_tax_savings", pct: "0.5", priority: 1 }],
    };
    const without = recompute(base);
    const withSpend = recompute({ ...base, variableAnnualSpending: Money.of("12000") });

    expect(without.totalExpenses.toString()).toBe("40000.0000");
    expect(withSpend.totalExpenses.toString()).toBe("52000.0000");
    // FI number = totalExpenses / swr → 40k/.04=1,000,000 vs 52k/.04=1,300,000
    expect(without.fire.fiNumber.toString()).toBe("1000000.0000");
    expect(withSpend.fire.fiNumber.toString()).toBe("1300000.0000");
    // savings pool (post_tax_savings base) shrinks by the extra spend, so the brokerage dial contributes less
    const b0 = without.buckets.find((b) => b.bucket === "brokerage")!;
    const b1 = withSpend.buckets.find((b) => b.bucket === "brokerage")!;
    expect(b1.amount.compare(b0.amount)).toBe(-1);
  });

  it("recurring commitments raise total expenses and merge into the Essentials slice", () => {
    const base: ProfileState = {
      incomeSources: [{ grossAmount: Money.of("120000"), frequency: "annual" }],
      annualExpenses: Money.of("40000"),
      taxProfile: { filingStatus: "single", state: "TX", taxYear: 2026 },
      plan: { currentBalance: Money.of("0"), swr: "0.04", realReturn: "0.05", currentAge: 35, targetRetireAge: 65 },
      dials: [{ bucket: "brokerage", base: "post_tax_savings", pct: "1", priority: 1 }],
    };
    const without = recompute(base);
    const withBills = recompute({ ...base, annualCommitments: Money.of("9000") });

    expect(withBills.commitments.toString()).toBe("9000.0000");
    expect(withBills.totalExpenses.toString()).toBe("49000.0000");
    // FI number climbs: 40k/.04=1,000,000 vs 49k/.04=1,225,000
    expect(withBills.fire.fiNumber.toString()).toBe("1225000.0000");
    // bills claim the savings pool, so the brokerage dial contributes less
    const b0 = without.buckets.find((b) => b.bucket === "brokerage")!;
    const b1 = withBills.buckets.find((b) => b.bucket === "brokerage")!;
    expect(b1.amount.compare(b0.amount)).toBe(-1);
    // Essentials = baseline living (40k) + bills (9k); slices still sum to gross
    expect(withBills.whereItGoes.find((s) => s.label === "Essentials")!.amount.toString()).toBe("49000.0000");
    expect(withBills.whereItGoes.find((s) => s.label === "Bills")).toBeUndefined();
    const sum = withBills.whereItGoes.reduce((a, s) => a.add(s.amount), Money.zero());
    expect(sum.toString()).toBe("120000.0000");
  });

  it("recurring auto-invest claims the pool but counts as a contribution", () => {
    const base: ProfileState = {
      incomeSources: [{ grossAmount: Money.of("120000"), frequency: "annual" }],
      annualExpenses: Money.of("40000"),
      taxProfile: { filingStatus: "single", state: "TX", taxYear: 2026 },
      plan: { currentBalance: Money.of("0"), swr: "0.04", realReturn: "0.05", currentAge: 35, targetRetireAge: 65 },
      // no dials: isolate the flat auto-invest so it's the only contribution
      dials: [],
    };
    const without = recompute(base);
    const withAuto = recompute({ ...base, annualInvestments: Money.of("2600") });

    expect(without.totalContributions.toString()).toBe("0.0000");
    // $50/wk ≈ $2,600/yr flows straight into contributions
    expect(withAuto.autoInvestments.toString()).toBe("2600.0000");
    expect(withAuto.totalContributions.toString()).toBe("2600.0000");
    // it's investing, not an expense — total expenses and the FI number are unchanged
    expect(withAuto.totalExpenses.toString()).toBe(without.totalExpenses.toString());
    expect(withAuto.fire.fiNumber.toString()).toBe(without.fire.fiNumber.toString());
    // savings rate rises; the Investing slice reflects the auto-invest
    expect(Number(withAuto.savingsRate)).toBeGreaterThan(Number(without.savingsRate));
    expect(withAuto.whereItGoes.find((s) => s.label === "Investing")!.amount.toString()).toBe("2600.0000");
    const sum = withAuto.whereItGoes.reduce((a, s) => a.add(s.amount), Money.zero());
    expect(sum.toString()).toBe("120000.0000");
  });

  it("employer match adds to contributions and net worth but not to the gross breakdown", () => {
    const base: ProfileState = {
      incomeSources: [{ grossAmount: Money.of("100000"), frequency: "annual" }],
      annualExpenses: Money.of("40000"),
      taxProfile: { filingStatus: "single", state: "TX", taxYear: 2026 },
      plan: { currentBalance: Money.of("0"), swr: "0.04", realReturn: "0.05", currentAge: 35, targetRetireAge: 65 },
      dials: [{ bucket: "brokerage", base: "post_tax_savings", pct: "0.5", priority: 1 }],
    };
    const without = recompute(base);
    const withMatch = recompute({ ...base, plan: { ...base.plan, employerMatchPercent: "0.04" } });

    // 4% of $100k = $4,000 free money on top of your own contributions
    expect(withMatch.employerMatch.toString()).toBe("4000.0000");
    expect(withMatch.ownContributions.toString()).toBe(without.ownContributions.toString());
    expect(withMatch.totalContributions.toString()).toBe(without.ownContributions.add(Money.of("4000")).toString());
    // savings rate is your own rate — unchanged by the match
    expect(withMatch.savingsRate).toBe(without.savingsRate);
    // match is not part of your paycheck, so the breakdown still sums to gross
    const sum = withMatch.whereItGoes.reduce((a, s) => a.add(s.amount), Money.zero());
    expect(sum.toString()).toBe("100000.0000");
    expect(withMatch.whereItGoes.find((s) => s.label === "Investing")!.amount.toString()).toBe(without.ownContributions.toString());
  });

  it("goal contributions claim the savings pool; whereItGoes sums to gross", () => {
    const base: ProfileState = {
      incomeSources: [{ grossAmount: Money.of("120000"), frequency: "annual" }],
      annualExpenses: Money.of("40000"),
      taxProfile: { filingStatus: "single", state: "TX", taxYear: 2026 },
      plan: { currentBalance: Money.of("0"), swr: "0.04", realReturn: "0.05", currentAge: 35, targetRetireAge: 65 },
      dials: [{ bucket: "brokerage", base: "post_tax_savings", pct: "1", priority: 1 }],
    };
    const without = recompute(base);
    const withGoals = recompute({ ...base, annualGoalContributions: Money.of("6000") });

    // goals reduce what the brokerage dial can draw from the pool
    const b0 = without.buckets.find((b) => b.bucket === "brokerage")!;
    const b1 = withGoals.buckets.find((b) => b.bucket === "brokerage")!;
    expect(b1.amount.compare(b0.amount)).toBe(-1);
    expect(withGoals.goalContributions.toString()).toBe("6000.0000");

    // the breakdown slices sum to gross
    const sum = withGoals.whereItGoes.reduce((a, s) => a.add(s.amount), Money.zero());
    expect(sum.toString()).toBe("120000.0000");
    expect(withGoals.whereItGoes.find((s) => s.label === "Goals")!.amount.toString()).toBe("6000.0000");
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
