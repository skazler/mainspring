import { Money } from "@mainspring/schema";
import { describe, expect, it } from "vitest";
import { annualizeSpending, annualizeMonth, monthTotal, spendingByCategory, type SpendingEntry } from "../../src/index";

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
