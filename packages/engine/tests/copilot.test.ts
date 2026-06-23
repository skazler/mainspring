import type { CopilotCommand } from "@mainspring/schema";
import { describe, expect, it } from "vitest";
import { applyCopilotCommand, type DialInput } from "../src/index";

const dials: DialInput[] = [
  { bucket: "401k_pretax", base: "gross", pct: "0.1", priority: 1 },
  { bucket: "brokerage", base: "post_tax_savings", pct: "0.2", priority: 2 },
];

describe("applyCopilotCommand", () => {
  it("updates an existing dial's pct", () => {
    const cmd: CopilotCommand = { adjustments: [{ bucket: "401k_pretax", base: "gross", pct: "0.15" }] };
    const next = applyCopilotCommand(dials, cmd);
    expect(next.find((d) => d.bucket === "401k_pretax")!.pct).toBe("0.15");
    expect(next.find((d) => d.bucket === "brokerage")!.pct).toBe("0.2"); // untouched
  });

  it("adds a new dial when the bucket/base isn't present", () => {
    const cmd: CopilotCommand = { adjustments: [{ bucket: "hsa", base: "gross", pct: "0.05" }] };
    const next = applyCopilotCommand(dials, cmd);
    const hsa = next.find((d) => d.bucket === "hsa")!;
    expect(hsa.pct).toBe("0.05");
    expect(hsa.priority).toBe(3); // after the max existing priority
  });

  it("clamps so a shared base can't exceed 100% — the engine overrides the LLM", () => {
    // gross already has 401k at 0.1; proposing 0.95 more on gross would total 1.05
    const cmd: CopilotCommand = { adjustments: [{ bucket: "ira", base: "gross", pct: "0.95" }] };
    const next = applyCopilotCommand(dials, cmd);
    expect(next.find((d) => d.bucket === "ira")!.pct).toBe("0.9"); // clamped to remaining 1 − 0.1
  });

  it("does not mutate the input dials", () => {
    applyCopilotCommand(dials, { adjustments: [{ bucket: "401k_pretax", base: "gross", pct: "0.3" }] });
    expect(dials[0]!.pct).toBe("0.1");
  });
});
