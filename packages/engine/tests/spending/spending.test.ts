import { Money } from "@mainspring/schema";
import { describe, expect, it } from "vitest";
import {
  annualizeSpending,
  annualizeMonth,
  annualizeTrailing,
  trailingTotal,
  monthTotal,
  spendingByCategory,
  type SpendingEntry,
} from "../../src/index";

const e = (category: string, amount: string, spentAt: string): SpendingEntry => ({
  category,
  amount: Money.of(amount),
  spentAt,
});

describe("annualizeSpending", () => {
  it("scales by the number of months covered", () => {
    // $100 in one month → $1,200/yr
    expect(annualizeSpending([e("coffee", "100", "2026-07-01")]).toString()).toBe("1200.0000");
    // $200 across two months → $1,200/yr
    const two = annualizeSpending([e("coffee", "100", "2026-06-10"), e("coffee", "100", "2026-07-10")]);
    expect(two.toString()).toBe("1200.0000");
  });

  it("is zero for no entries", () => {
    expect(annualizeSpending([]).toString()).toBe("0.0000");
  });
});

describe("annualizeMonth / monthTotal (monthly reset)", () => {
  const rows = [
    e("coffee", "50", "2026-06-20"), // previous month — ignored
    e("dining", "100", "2026-07-05"),
    e("coffee", "20", "2026-07-18"),
  ];
  it("counts only the given month, projected ×12", () => {
    expect(monthTotal(rows, "2026-07").toString()).toBe("120.0000");
    expect(annualizeMonth(rows, "2026-07").toString()).toBe("1440.0000");
    // last month resets away from this month's figure
    expect(annualizeMonth(rows, "2026-06").toString()).toBe("600.0000");
  });
  it("is zero for a month with no entries", () => {
    expect(annualizeMonth(rows, "2026-08").toString()).toBe("0.0000");
  });
});

describe("annualizeTrailing (sliding 30-day window)", () => {
  // A steady $10/day for well over the window, so coverage is the full 30 days.
  const steady: SpendingEntry[] = [];
  for (let d = 1; d <= 31; d++) steady.push(e("coffee", "10", `2026-07-${String(d).padStart(2, "0")}`));
  for (let d = 1; d <= 3; d++) steady.push(e("coffee", "10", `2026-08-0${d}`));

  it("counts the window inclusive of asOf and scales by 365/30", () => {
    // Jul 5 – Aug 3 inclusive = 30 days × $10 = $300 → $300 × 365/30 = $3,650
    expect(trailingTotal(steady, "2026-08-03").toString()).toBe("300.0000");
    expect(annualizeTrailing(steady, "2026-08-03").toString()).toBe("3650.0000");
  });

  it("does not reset at the month boundary — the whole point of the change", () => {
    // Jul 31 → Aug 1 → Aug 2 stay flat, where annualizeMonth collapses to ~0.
    const jul31 = annualizeTrailing(steady, "2026-07-31").toString();
    const aug01 = annualizeTrailing(steady, "2026-08-01").toString();
    const aug02 = annualizeTrailing(steady, "2026-08-02").toString();
    expect(jul31).toBe("3650.0000");
    expect(aug01).toBe("3650.0000");
    expect(aug02).toBe("3650.0000");
    // The old behaviour, for contrast: the 1st of the month is a cliff.
    expect(annualizeMonth(steady, "2026-07").toString()).toBe("3720.0000");
    expect(annualizeMonth(steady, "2026-08").toString()).toBe("360.0000");
  });

  it("drops entries that fall out the back of the window", () => {
    // Jun 20 is outside Jul 5 – Aug 3.
    const withOld = [...steady, e("dining", "500", "2026-06-20")];
    expect(trailingTotal(withOld, "2026-08-03").toString()).toBe("300.0000");
  });

  it("extrapolates from the covered span when history is shorter than the window", () => {
    // Logging started 10 days ago: $200 over Jul 25–Aug 3 → ×365/10 = $7,300.
    const young = [e("dining", "200", "2026-07-25")];
    expect(annualizeTrailing(young, "2026-08-03").toString()).toBe("7300.0000");
  });

  it("floors the divisor at 7 days so day-one logging can't imply a fortune", () => {
    // One $80 run on the first day: ÷7, not ÷1 → $4,171 rather than $29,200.
    const dayOne = [e("groceries", "80", "2026-08-03")];
    expect(annualizeTrailing(dayOne, "2026-08-03").toString()).toBe("4171.4286");
  });

  it("measures coverage from the earliest entry overall, not the earliest in-window", () => {
    // Established logger (since May) who happened to spend only in the last 3
    // days. Coverage is the full 30 days, so $90 → $1,095/yr — NOT ÷7.
    const established = [
      e("coffee", "40", "2026-05-02"),
      e("dining", "30", "2026-08-01"),
      e("dining", "30", "2026-08-02"),
      e("dining", "30", "2026-08-03"),
    ];
    expect(annualizeTrailing(established, "2026-08-03").toString()).toBe("1095.0000");
  });

  it("is zero for no entries and for an empty window", () => {
    expect(annualizeTrailing([], "2026-08-03").toString()).toBe("0.0000");
    expect(annualizeTrailing([e("coffee", "10", "2026-01-01")], "2026-08-03").toString()).toBe("0.0000");
  });

  it("ignores entries dated after asOf", () => {
    const future = [...steady, e("dining", "999", "2026-09-01")];
    expect(trailingTotal(future, "2026-08-03").toString()).toBe("300.0000");
  });

  it("handles month and year boundaries in the window arithmetic", () => {
    // Window Dec 17 2025 – Jan 15 2026 spans the new year.
    const across = [e("gifts", "100", "2025-12-20"), e("dining", "100", "2026-01-10"), e("old", "50", "2025-12-01")];
    expect(trailingTotal(across, "2026-01-15").toString()).toBe("200.0000");
  });
});

describe("spendingByCategory", () => {
  it("totals per category, largest first", () => {
    const byCat = spendingByCategory([
      e("coffee", "5", "2026-07-01"),
      e("clothes", "130", "2026-07-02"),
      e("coffee", "5", "2026-07-03"),
    ]);
    expect(byCat.map((c) => c.category)).toEqual(["clothes", "coffee"]);
    expect(byCat[0]!.total.toString()).toBe("130.0000");
    expect(byCat[1]!.total.toString()).toBe("10.0000");
  });
});
