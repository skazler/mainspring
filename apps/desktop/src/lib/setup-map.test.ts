import { describe, expect, it } from "vitest";
import { buildProfileState, defaultSetupForm } from "./setup-map";

describe("buildProfileState", () => {
  it("maps the default form to a ProfileState", () => {
    const p = buildProfileState(defaultSetupForm());

    expect(p.incomeSources[0]!.grossAmount.toString()).toBe("105000.0000");
    expect(p.taxProfile).toEqual({ filingStatus: "single", state: "TX", taxYear: 2026 });
    expect(p.plan.swr).toBe("0.04");
    expect(p.plan.realReturn).toBe("0.05");
    // no unitemized baseline — essentials come from itemized bills
    expect(p.annualExpenses.toString()).toBe("0.0000");

    // only the enabled buckets become dials: ira, brokerage
    expect(p.dials.map((d) => d.bucket)).toEqual(["ira", "brokerage"]);
    const ira = p.dials.find((d) => d.bucket === "ira")!;
    expect(ira.pct).toBe("0.05");
    expect(ira.annualCap?.toString()).toBe("7500.0000");
    const brokerage = p.dials.find((d) => d.bucket === "brokerage")!;
    expect(brokerage.pct).toBe("0.3");
    expect(brokerage.annualCap).toBeUndefined(); // uncapped bucket
  });

  it("uppercases the state and drops disabled / zero-percent buckets", () => {
    const form = defaultSetupForm();
    form.state = "tx";
    form.contributions = form.contributions.map((c) =>
      c.bucket === "brokerage" ? { ...c, percent: 0 } : c,
    );
    const p = buildProfileState(form);
    expect(p.taxProfile.state).toBe("TX");
    expect(p.dials.map((d) => d.bucket)).toEqual(["ira"]);
  });
});
