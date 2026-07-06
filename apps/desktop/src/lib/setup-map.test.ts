import { describe, expect, it } from "vitest";
import { buildProfileState, defaultSetupForm, fullWeights, normalizeSetupForm } from "./setup-map";

describe("buildProfileState", () => {
  it("maps the default form to a ProfileState", () => {
    const p = buildProfileState(defaultSetupForm());

    expect(p.incomeSources[0]!.grossAmount.toString()).toBe("0.0000"); // blank default — no personal figures
    expect(p.taxProfile).toEqual({ filingStatus: "single", state: "TX", taxYear: 2026 });
    expect(p.plan.swr).toBe("0.04");
    expect(p.plan.realReturn).toBe("0.05");
    // no unitemized baseline — essentials come from itemized bills
    expect(p.annualExpenses.toString()).toBe("0.0000");

    // only the enabled buckets become dials: 401k, Roth IRA, brokerage (F20)
    expect(p.dials.map((d) => d.bucket)).toEqual(["401k_pretax", "roth_ira", "brokerage"]);
    const k401 = p.dials.find((d) => d.bucket === "401k_pretax")!;
    expect(k401.pct).toBe("0.15");
    expect(k401.annualCap?.toString()).toBe("24500.0000");
    const roth = p.dials.find((d) => d.bucket === "roth_ira")!;
    expect(roth.pct).toBe("0.05");
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
    expect(p.dials.map((d) => d.bucket)).toEqual(["401k_pretax", "roth_ira"]);
  });

  it("converts a fixed dollar (amount-mode) gross contribution to a % of gross", () => {
    const form = defaultSetupForm();
    form.grossAmount = 100000;
    form.contributions = form.contributions.map((c) =>
      c.bucket === "roth_401k" ? { ...c, enabled: true, mode: "amount" as const, amount: 10000 } : c,
    );
    const p = buildProfileState(form);
    const roth = p.dials.find((d) => d.bucket === "roth_401k")!;
    // 10,000 / 100,000 = 0.1
    expect(roth.pct).toBe("0.1");
  });
});

describe("calibre (C2)", () => {
  it("the default form carries the three-fund default calibre summing to 1", () => {
    const c = defaultSetupForm().calibre;
    expect(c.name).toBe("Three-fund");
    expect(c.weights.us_total).toBe("0.6");
    expect(c.weights.intl_dev).toBe("0.3");
    expect(c.weights.bonds).toBe("0.1");
    expect(c.weights.cash).toBe("0");
    const sum = Object.values(c.weights).reduce((a, w) => a + Number(w), 0);
    expect(sum).toBeCloseTo(1, 10);
  });

  it("normalizeSetupForm backfills the default calibre for older saved forms", () => {
    const legacy = defaultSetupForm();
    delete (legacy as { calibre?: unknown }).calibre; // saved before calibre existed
    expect(normalizeSetupForm(legacy).calibre.name).toBe("Three-fund");
  });

  it("a calibre survives a scenario JSON round-trip exactly", () => {
    const form = defaultSetupForm();
    form.calibre = { name: "Custom", weights: fullWeights({ us_large: "0.7", emerging: "0.3" }) };
    const back = JSON.parse(JSON.stringify(form)).calibre;
    expect(back).toEqual(form.calibre);
    expect(back.weights.us_large).toBe("0.7");
    expect(back.weights.us_total).toBe("0");
  });
});
