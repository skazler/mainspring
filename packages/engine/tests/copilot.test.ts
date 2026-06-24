import type { DialAdjustment } from "@mainspring/schema";
import { describe, expect, it } from "vitest";
import { applyDialAdjustments, type DialInput } from "../src/index";

const dials: DialInput[] = [
  { bucket: "401k_pretax", base: "gross", pct: "0.1", priority: 1 },
  { bucket: "brokerage", base: "post_tax_savings", pct: "0.2", priority: 2 },
];

describe("applyDialAdjustments", () => {
  it("updates an existing dial's pct", () => {
    const adj: DialAdjustment[] = [{ bucket: "401k_pretax", base: "gross", pct: "0.15" }];
    const next = applyDialAdjustments(dials, adj);
    expect(next.find((d) => d.bucket === "401k_pretax")!.pct).toBe("0.15");
    expect(next.find((d) => d.bucket === "brokerage")!.pct).toBe("0.2");
  });

  it("adds a new dial when the bucket/base isn't present", () => {
    const next = applyDialAdjustments(dials, [{ bucket: "hsa", base: "gross", pct: "0.05" }]);
    const hsa = next.find((d) => d.bucket === "hsa")!;
    expect(hsa.pct).toBe("0.05");
    expect(hsa.priority).toBe(3);
  });

  it("clamps so a shared base can't exceed 100% — the engine overrides the model", () => {
    const next = applyDialAdjustments(dials, [{ bucket: "ira", base: "gross", pct: "0.95" }]);
    expect(next.find((d) => d.bucket === "ira")!.pct).toBe("0.9"); // 1 − 0.1 already on gross
  });

  it("no adjustments leaves dials unchanged; input is not mutated", () => {
    const next = applyDialAdjustments(dials, []);
    expect(next).toEqual(dials);
    applyDialAdjustments(dials, [{ bucket: "401k_pretax", base: "gross", pct: "0.3" }]);
    expect(dials[0]!.pct).toBe("0.1");
  });
});
