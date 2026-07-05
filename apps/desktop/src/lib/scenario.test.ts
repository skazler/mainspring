import { describe, expect, it } from "vitest";
import { scenarioSummary } from "./scenario";
import { defaultSetupForm } from "./setup-map";

describe("scenarioSummary", () => {
  it("summarizes a plan with income", () => {
    // The default form is now blank (no personal figures), so give it an income.
    const f = defaultSetupForm();
    f.grossAmount = 100000;
    const s = scenarioSummary(f);
    // No unitemized baseline — expenses (and the FI number) come from itemized
    // bills the user adds, so the seed FI is 0.
    expect(s.fiNumber).toBe(0);
    expect(s.takeHome).toBeGreaterThan(0);
    expect(s.savingsRate).toBeGreaterThan(0);
    expect(s.savingsRate).toBeLessThan(1);
  });

  it("a higher savings rate reaches FI no later", () => {
    const lean = defaultSetupForm();
    lean.grossAmount = 100000;
    const heavy = defaultSetupForm();
    heavy.grossAmount = 100000;
    heavy.contributions = heavy.contributions.map((c) =>
      c.bucket === "brokerage" ? { ...c, percent: 60 } : c,
    );
    const a = scenarioSummary(lean);
    const b = scenarioSummary(heavy);
    expect(b.savingsRate).toBeGreaterThan(a.savingsRate);
    if (a.fiAge !== null && b.fiAge !== null) expect(b.fiAge).toBeLessThanOrEqual(a.fiAge);
  });
});
