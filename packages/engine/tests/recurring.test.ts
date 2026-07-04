import { describe, it, expect } from "vitest";
import { Money } from "@mainspring/schema";
import { annualizeRecurring, annualizeItem, recurringByCategory } from "../src/recurring/recurring";

describe("recurring commitments", () => {
  it("annualizes a single item by cadence", () => {
    expect(annualizeItem({ amount: Money.of("50"), cadence: "weekly" }).toString()).toBe("2600.0000");
    expect(annualizeItem({ amount: Money.of("100"), cadence: "biweekly" }).toString()).toBe("2600.0000");
    expect(annualizeItem({ amount: Money.of("50"), cadence: "monthly" }).toString()).toBe("600.0000");
    expect(annualizeItem({ amount: Money.of("300"), cadence: "quarterly" }).toString()).toBe("1200.0000");
    expect(annualizeItem({ amount: Money.of("1800"), cadence: "annual" }).toString()).toBe("1800.0000");
  });

  it("sums active items across cadences", () => {
    const total = annualizeRecurring([
      { amount: Money.of("120"), cadence: "monthly" }, // 1440
      { amount: Money.of("150"), cadence: "quarterly" }, // 600
      { amount: Money.of("900"), cadence: "annual" }, // 900
    ]);
    expect(total.toString()).toBe("2940.0000");
  });

  it("excludes paused items and handles the empty case", () => {
    expect(annualizeRecurring([]).toString()).toBe("0.0000");
    const total = annualizeRecurring([
      { amount: Money.of("100"), cadence: "monthly" },
      { amount: Money.of("999"), cadence: "monthly", active: false },
    ]);
    expect(total.toString()).toBe("1200.0000");
  });

  it("groups annualized cost by category, largest first, skipping paused", () => {
    const rows = recurringByCategory([
      { amount: Money.of("20"), cadence: "monthly", category: "software dev" }, // 240
      { amount: Money.of("300"), cadence: "annual", category: "software dev" }, // 300 → 540
      { amount: Money.of("100"), cadence: "monthly", category: "insurance" }, // 1200
      { amount: Money.of("999"), cadence: "monthly", category: "car", active: false }, // skipped
    ]);
    expect(rows.map((r) => r.category)).toEqual(["insurance", "software dev"]);
    expect(rows[0]!.annual.toString()).toBe("1200.0000");
    expect(rows[1]!.annual.toString()).toBe("540.0000");
  });
});
