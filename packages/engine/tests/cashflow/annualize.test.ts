import { Money } from "@mainspring/schema";
import { describe, expect, it } from "vitest";
import { annualizeIncome } from "../../src/index";

describe("annualizeIncome", () => {
  it("annualizes each frequency", () => {
    expect(annualizeIncome([{ grossAmount: Money.of("2000"), frequency: "biweekly" }]).toString()).toBe("52000.0000");
    expect(annualizeIncome([{ grossAmount: Money.of("5000"), frequency: "monthly" }]).toString()).toBe("60000.0000");
    expect(annualizeIncome([{ grossAmount: Money.of("1500"), frequency: "weekly" }]).toString()).toBe("78000.0000");
    expect(annualizeIncome([{ grossAmount: Money.of("100000"), frequency: "annual" }]).toString()).toBe("100000.0000");
  });

  it("sums multiple sources", () => {
    const total = annualizeIncome([
      { grossAmount: Money.of("90000"), frequency: "annual" },
      { grossAmount: Money.of("1000"), frequency: "monthly" }, // 12,000
    ]);
    expect(total.toString()).toBe("102000.0000");
  });

  it("is zero for no sources", () => {
    expect(annualizeIncome([]).toString()).toBe("0.0000");
  });
});
