import { Money } from "@mainspring/schema";
import { describe, expect, it } from "vitest";
import { budgetIncomeIn, monthlyBudget, recompute, trailingIncome, type IncomeEntry, type ProfileState } from "../../src/index";

const m = (v: string) => Money.of(v);
const e = (amount: string, receivedAt: string, selfEmployed = true, toBudget = false): IncomeEntry => ({
  amount: m(amount),
  receivedAt,
  selfEmployed,
  toBudget,
});

describe("trailingIncome", () => {
  const entries = [
    e("2000", "2026-09-01"), // gig, in window
    e("500", "2026-03-10", false), // gift, in window
    e("1000", "2025-09-15"), // exactly 365 days back from 2026-09-14 → in
    e("9999", "2025-09-14"), // 366 days back → out
    e("300", "2026-09-10", true, true), // budget-bound → never in the plan
    e("777", "2026-09-20"), // future-dated → out
  ];

  it("sums the trailing year, split by tax treatment, without scaling it up", () => {
    const t = trailingIncome(entries, "2026-09-14");
    expect(t.selfEmployed.toString()).toBe("3000.0000");
    expect(t.untaxed.toString()).toBe("500.0000");
  });

  it("does not extrapolate a first payout into a year", () => {
    const t = trailingIncome([e("2000", "2026-09-10")], "2026-09-14");
    expect(t.selfEmployed.toString()).toBe("2000.0000");
  });

  it("slides daily rather than resetting on January 1st", () => {
    const t = trailingIncome([e("1200", "2025-12-20")], "2026-01-02");
    expect(t.selfEmployed.toString()).toBe("1200.0000");
  });
});

describe("budgetIncomeIn", () => {
  it("takes only budget-bound entries from that calendar month", () => {
    const b = budgetIncomeIn(
      [e("300", "2026-09-10", true, true), e("50", "2026-09-02", false, true), e("400", "2026-08-31", true, true), e("900", "2026-09-05")],
      "2026-09",
    );
    expect(b.selfEmployed.toString()).toBe("300.0000");
    expect(b.untaxed.toString()).toBe("50.0000");
  });
});

describe("recompute with irregular income", () => {
  const state = (over: Partial<ProfileState> = {}): ProfileState => ({
    incomeSources: [{ grossAmount: m("50000"), frequency: "annual" }],
    annualExpenses: m("20000"),
    taxProfile: { filingStatus: "single", state: "TX", taxYear: 2026 },
    plan: { currentBalance: m("0"), swr: "0.04", realReturn: "0.05", currentAge: 30, targetRetireAge: 65, employerMatchPercent: "0.04" },
    dials: [{ bucket: "401k_pretax", base: "gross", pct: "0.1", priority: 1 }],
    ...over,
  });

  it("adds to gross and take-home, but payroll dials and the match still read wages", () => {
    const r = recompute(state({ irregularIncome: { selfEmployed: m("20000"), untaxed: m("1000") } }));
    expect(r.wages.toString()).toBe("50000.0000");
    expect(r.irregularIncome.toString()).toBe("21000.0000");
    expect(r.gross.toString()).toBe("71000.0000");
    expect(r.buckets.find((b) => b.bucket === "401k_pretax")!.amount.toString()).toBe("5000.0000");
    expect(r.employerMatch.toString()).toBe("2000.0000");
    // untaxed income passes straight through to net
    expect(r.net.toString()).toBe(r.tax.net.add(m("1000")).toString());
    expect(r.tax.selfEmployment.isZero()).toBe(false);
    // the breakdown still sums to gross
    const sum = r.whereItGoes.reduce((s, x) => s.add(x.amount), Money.zero());
    expect(sum.toString()).toBe(r.gross.add(r.deficit).toString());
  });

  it("is identical to the wage-only plan when nothing is logged", () => {
    const a = recompute(state());
    const b = recompute(state({ irregularIncome: { selfEmployed: Money.zero(), untaxed: Money.zero() } }));
    expect(b.gross.toString()).toBe(a.gross.toString());
    expect(b.tax.total.toString()).toBe(a.tax.total.toString());
    expect(b.budgetIncome.toString()).toBe("0.0000");
  });

  it("taxes budget-bound side income on top of the plan and keeps it out of gross", () => {
    // $50k wages, 401k 5k pre-tax → taxable 28,900 (12% bracket).
    // $1,000 SE: NE 923.5 → SE tax 141.2955, deduction 70.64775
    // extra income tax 12% × (1,000 − 70.64775) = 111.52227
    // after tax: 1,000 − 141.2955 − 111.52227 = 747.18223
    const r = recompute(state({ budgetIncome: { selfEmployed: m("1000"), untaxed: m("0") } }));
    expect(r.budgetIncome.toString()).toBe("747.1822");
    expect(r.gross.toString()).toBe("50000.0000");
  });

  it("passes a budget-bound gift through untaxed", () => {
    const r = recompute(state({ budgetIncome: { selfEmployed: Money.zero(), untaxed: m("250") } }));
    expect(r.budgetIncome.toString()).toBe("250.0000");
  });
});

describe("monthlyBudget with extra income", () => {
  it("adds the extra whole to this month's allowance", () => {
    const b = monthlyBudget(m("12000"), m("400"), m("300"));
    expect(b.allowance.toString()).toBe("1300.0000");
    expect(b.extra.toString()).toBe("300.0000");
    expect(b.remaining.toString()).toBe("900.0000");
  });

  it("can lift an over-committed month back above zero", () => {
    const b = monthlyBudget(m("-1200"), Money.zero(), m("250"));
    expect(b.allowance.toString()).toBe("150.0000");
    expect(b.overCommitted).toBe(false);
  });
});
