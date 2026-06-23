import { describe, expect, it } from "vitest";
import { scenarioSummary } from "./scenario";
import { defaultSetupForm } from "./setup-map";

describe("scenarioSummary", () => {
  it("summarizes the default plan", () => {
    const s = scenarioSummary(defaultSetupForm());
    // FI number = annual expenses / swr = 45,000 / 0.04 = 1,125,000
    expect(s.fiNumber).toBe(1_125_000);
    expect(s.takeHome).toBeGreaterThan(0);
    expect(s.savingsRate).toBeGreaterThan(0);
    expect(s.savingsRate).toBeLessThan(1);
  });

  it("a higher savings rate reaches FI no later", () => {
    const lean = defaultSetupForm();
    const heavy = defaultSetupForm();
    heavy.contributions = heavy.contributions.map((c) =>
      c.bucket === "brokerage" ? { ...c, percent: 60 } : c,
    );
    const a = scenarioSummary(lean);
    const b = scenarioSummary(heavy);
    expect(b.savingsRate).toBeGreaterThan(a.savingsRate);
    if (a.fiAge !== null && b.fiAge !== null) expect(b.fiAge).toBeLessThanOrEqual(a.fiAge);
  });
});
