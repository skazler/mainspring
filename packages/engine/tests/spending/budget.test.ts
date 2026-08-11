import { Money } from "@mainspring/schema";
import { describe, expect, it } from "vitest";
import { annualizeTrailing, monthlyBudget, type SpendingEntry } from "../../src/index";

const e = (category: string, amount: string, spentAt: string): SpendingEntry => ({
  category,
  amount: Money.of(amount),
  spentAt,
});

const m = (v: string) => Money.of(v);

describe("monthlyBudget", () => {
  it("splits the annual allowance into a monthly one and draws it down", () => {
    const b = monthlyBudget(m("12000"), m("350"));
    expect(b.allowance.toString()).toBe("1000.0000");
    expect(b.spent.toString()).toBe("350.0000");
    expect(b.remaining.toString()).toBe("650.0000");
    expect(Number(b.used)).toBeCloseTo(0.35, 6);
    expect(b.overCommitted).toBe(false);
  });

  it("resets to the full allowance when nothing has been spent yet", () => {
    expect(monthlyBudget(m("12000"), Money.zero()).remaining.toString()).toBe("1000.0000");
  });

  it("goes negative once the month is overspent", () => {
    const b = monthlyBudget(m("12000"), m("1250"));
    expect(b.remaining.toString()).toBe("-250.0000");
    expect(Number(b.used)).toBeCloseTo(1.25, 6);
    expect(b.overCommitted).toBe(false);
  });

  it("flags a negative allowance as over-committed rather than as overspending", () => {
    const b = monthlyBudget(m("-2400"), m("100"));
    expect(b.allowance.toString()).toBe("-200.0000");
    expect(b.overCommitted).toBe(true);
    // No allowance to have used a share of — don't report a nonsense percentage.
    expect(Number(b.used)).toBe(0);
  });

  it("reports no usage against a zero allowance instead of dividing by zero", () => {
    const b = monthlyBudget(Money.zero(), m("50"));
    expect(Number(b.used)).toBe(0);
    expect(b.remaining.toString()).toBe("-50.0000");
  });
});

/**
 * The regression this whole split exists for: within a month, "remaining" must
 * only ever fall. The trailing window can't promise that — a purchase leaving
 * the window pushes the run-rate down, which pushed remaining back up mid-month.
 */
describe("remaining is monotonic within a month", () => {
  // A month of ordinary lumpy spending, plus a big purchase 30 days back that
  // ages out of the trailing window on the 2nd.
  const rows: SpendingEntry[] = [
    e("travel", "900", "2026-06-03"),
    e("groceries", "140", "2026-06-28"),
    e("dining", "55", "2026-07-01"),
    e("groceries", "135", "2026-07-06"),
    e("dining", "70", "2026-07-10"),
    e("clothes", "220", "2026-07-18"),
    e("groceries", "130", "2026-07-25"),
  ];
  const days = Array.from({ length: 31 }, (_, i) => `2026-07-${String(i + 1).padStart(2, "0")}`);

  /** Month-to-date spending as of `day` — what the store feeds the budget. */
  const spentThrough = (day: string) =>
    rows
      .filter((r) => r.spentAt.slice(0, 7) === "2026-07" && r.spentAt <= day)
      .reduce((s, r) => s.add(r.amount), Money.zero());

  it("never rises during the month", () => {
    let prev = Infinity;
    for (const day of days) {
      const left = Number(monthlyBudget(m("36000"), spentThrough(day)).remaining.toString());
      expect(left).toBeLessThanOrEqual(prev);
      prev = left;
    }
  });

  it("starts the month at the full allowance no matter what came before", () => {
    // June's $1,040 is behind us; the 1st opens at $3,000 less that day's $55.
    expect(monthlyBudget(m("36000"), spentThrough("2026-07-01")).remaining.toString()).toBe("2945.0000");
  });

  it("contrast: the trailing run-rate DOES jump up mid-month when a purchase ages out", () => {
    // 2026-07-02 is 30 days after the $900 travel charge, so it leaves the window.
    const before = Number(annualizeTrailing(rows, "2026-07-02").toString());
    const after = Number(annualizeTrailing(rows, "2026-07-03").toString());
    expect(after).toBeLessThan(before);
    // ...while the budget holds flat over those same two days (nothing logged).
    expect(monthlyBudget(m("36000"), spentThrough("2026-07-03")).remaining.toString()).toBe(
      monthlyBudget(m("36000"), spentThrough("2026-07-02")).remaining.toString(),
    );
  });
});
