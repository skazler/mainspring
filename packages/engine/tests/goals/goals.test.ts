import { Money } from "@mainspring/schema";
import { describe, expect, it } from "vitest";
import { goalStatus, monthsBetween } from "../../src/index";

describe("goalStatus", () => {
  it("progress + remaining", () => {
    const s = goalStatus({ target: Money.of("40000"), saved: Money.of("10000") });
    expect(s.progress).toBe("0.2500");
    expect(s.remaining.toString()).toBe("30000.0000");
    expect(s.complete).toBe(false);
  });

  it("ETA from a monthly contribution (ceil)", () => {
    const s = goalStatus({ target: Money.of("40000"), saved: Money.of("10000"), monthlyContribution: Money.of("2000") });
    expect(s.monthsToGoal).toBe(15); // 30,000 / 2,000
  });

  it("required monthly to finish inside the timeline", () => {
    const s = goalStatus({ target: Money.of("12000"), saved: Money.of("0"), targetMonths: 12 });
    expect(s.requiredMonthly?.toString()).toBe("1000.0000");
  });

  it("the timeline is a span, not a date — the same goal reads the same on any day", () => {
    // The whole point of the change: a deadline re-priced itself every morning,
    // a timeline holds until the user edits it. Nothing here takes a clock, so
    // this is now true by construction — pinned so it stays that way.
    const goal = { target: Money.of("25000"), saved: Money.of("0"), targetMonths: 25 };
    expect(goalStatus(goal).requiredMonthly?.toString()).toBe("1000.0000");
    expect(goalStatus(goal).requiredMonthly?.toString()).toBe(goalStatus(goal).requiredMonthly?.toString());
  });

  it("no timeline, a zero timeline, or a met goal all give no required monthly", () => {
    const base = { target: Money.of("12000"), saved: Money.of("0") };
    expect(goalStatus(base).requiredMonthly).toBeNull();
    expect(goalStatus({ ...base, targetMonths: 0 }).requiredMonthly).toBeNull();
    expect(goalStatus({ target: Money.of("100"), saved: Money.of("100"), targetMonths: 6 }).requiredMonthly).toBeNull();
  });

  it("splits the REMAINING amount over the timeline, not the whole target", () => {
    const s = goalStatus({ target: Money.of("12000"), saved: Money.of("6000"), targetMonths: 6 });
    expect(s.requiredMonthly?.toString()).toBe("1000.0000");
  });

  it("a met goal is complete with 0 months and capped progress", () => {
    const s = goalStatus({ target: Money.of("5000"), saved: Money.of("6000") });
    expect(s.complete).toBe(true);
    expect(s.monthsToGoal).toBe(0);
    expect(s.progress).toBe("1");
    expect(s.remaining.toString()).toBe("0.0000");
  });
});

describe("monthsBetween", () => {
  it("counts whole months", () => {
    expect(monthsBetween("2026-07-01", "2027-07-01")).toBe(12);
    expect(monthsBetween("2026-07-01", "2026-10-01")).toBe(3);
    expect(monthsBetween("2026-07-01", "2026-04-01")).toBe(-3);
  });
  it("F23: ignores day-of-month (calendar-boundary count) — pinned behavior", () => {
    // 31 Jan → 1 Mar is "just over a month" but crosses two month boundaries → 2.
    expect(monthsBetween("2026-01-31", "2026-03-01")).toBe(2);
    // same calendar month, any days → 0.
    expect(monthsBetween("2026-07-01", "2026-07-28")).toBe(0);
  });
});
