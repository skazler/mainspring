import { describe, expect, it } from "vitest";
import { constrainPct, remainingPct, type DialInput } from "../../src/index";

const dials: DialInput[] = [
  { bucket: "401k_pretax", base: "gross", pct: "0.5", priority: 1 },
  { bucket: "brokerage", base: "gross", pct: "0.3", priority: 2 },
  { bucket: "emergency", base: "net", pct: "0.4", priority: 1 },
];

describe("remainingPct", () => {
  it("is what's left on a base, excluding the dragged dial", () => {
    // gross base: others use 0.3 (brokerage) → dial 0 can go up to 0.7
    expect(remainingPct(dials, "gross", 0)).toBe("0.7");
    // gross base: others use 0.5 (401k) → brokerage can go up to 0.5
    expect(remainingPct(dials, "gross", 1)).toBe("0.5");
    // net base has only one dial → excluding it leaves the full 1
    expect(remainingPct(dials, "net", 2)).toBe("1");
  });

  it("never goes negative when already over-allocated", () => {
    const over: DialInput[] = [
      { bucket: "brokerage", base: "net", pct: "0.8", priority: 1 },
      { bucket: "emergency", base: "net", pct: "0.8", priority: 2 },
      { bucket: "cash", base: "net", pct: "0.8", priority: 3 },
    ];
    // excluding dial 0, the others sum to 1.6 → clamped to 0, not negative
    expect(remainingPct(over, "net", 0)).toBe("0");
  });
});

describe("constrainPct", () => {
  it("clamps a proposed drag into [0, max]", () => {
    expect(constrainPct("0.9", "0.7")).toBe("0.7"); // illegal drag prevented
    expect(constrainPct("-0.2", "0.7")).toBe("0");
    expect(constrainPct("0.5", "0.7")).toBe("0.5");
  });
});
