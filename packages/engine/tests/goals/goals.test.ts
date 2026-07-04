import { Money } from "@mainspring/schema";
import { describe, expect, it } from "vitest";
import { goalStatus, monthsBetween } from "../../src/index";

describe("goalStatus", () => {
  it("progress + remaining", () => {
    const s = goalStatus({ target: Money.of("40000"), saved: Money.of("10000") }, "2026-07-04");
    expect(s.progress).toBe("0.2500");
    expect(s.remaining.toString()).toBe("30000.0000");
    expect(s.complete).toBe(false);
  });

  it("ETA from a monthly contribution (ceil)", () => {
    const s = goalStatus(
      { target: Money.of("40000"), saved: Money.of("10000"), monthlyContribution: Money.of("2000") },
      "2026-07-04",
    );
    expect(s.monthsToGoal).toBe(15); // 30,000 / 2,000
  });

  it("required monthly to hit a deadline", () => {
    const s = goalStatus(
      { target: Money.of("12000"), saved: Money.of("0"), targetDate: "2027-07-01" },
      "2026-07-01",
    );
    // 12 months out, need 1,000/mo
    expect(s.requiredMonthly?.toString()).toBe("1000.0000");
  });

  it("a met goal is complete with 0 months and capped progress", () => {
    const s = goalStatus({ target: Money.of("5000"), saved: Money.of("6000") }, "2026-07-04");
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
});
