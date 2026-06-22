import { describe, expect, it } from "vitest";
import { angleToPct, pctToAngle, pointerToPct } from "./gauge-math";

describe("pctToAngle / angleToPct", () => {
  it("maps the sweep endpoints and midpoint", () => {
    expect(pctToAngle(0)).toBe(-135);
    expect(pctToAngle(1)).toBe(135);
    expect(pctToAngle(0.5)).toBe(0); // straight up
  });

  it("clamps out-of-range fractions", () => {
    expect(pctToAngle(-1)).toBe(-135);
    expect(pctToAngle(2)).toBe(135);
  });

  it("round-trips angle ↔ pct", () => {
    expect(angleToPct(-135)).toBeCloseTo(0, 10);
    expect(angleToPct(0)).toBeCloseTo(0.5, 10);
    expect(angleToPct(135)).toBeCloseTo(1, 10);
  });
});

describe("pointerToPct", () => {
  const cx = 50;
  const cy = 50;
  it("reads the needle from a pointer around the centre", () => {
    expect(pointerToPct(cx, cy, 50, 10)).toBeCloseTo(0.5, 6); // directly above → 50%
    expect(pointerToPct(cx, cy, 90, 50)).toBeCloseTo(0.833, 2); // right (90°) → (90+135)/270
    expect(pointerToPct(cx, cy, 10, 50)).toBeCloseTo(0.167, 2); // left (−90°) → (−90+135)/270
  });
});
