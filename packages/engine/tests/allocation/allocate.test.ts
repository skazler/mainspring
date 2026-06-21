import Decimal from "decimal.js";
import fc from "fast-check";
import { Money } from "@mainspring/schema";
import { describe, expect, it } from "vitest";
import { allocateBase, type DialInput } from "../../src/index";

describe("allocateBase — caps, priority, waterfall", () => {
  it("clamps a capped bucket; the overflow stays available to lower priority", () => {
    const r = allocateBase(Money.of("100000"), "gross", [
      { bucket: "401k_pretax", base: "gross", pct: "0.5", priority: 1, annualCap: Money.of("24500") },
      { bucket: "brokerage", base: "gross", pct: "0.1", priority: 2 },
    ]);
    const k401 = r.allocations.find((a) => a.bucket === "401k_pretax")!;
    const brok = r.allocations.find((a) => a.bucket === "brokerage")!;
    expect(k401.amount.toString()).toBe("24500.0000"); // 50% capped to the limit
    expect(k401.clampedByCap).toBe(true);
    expect(brok.amount.toString()).toBe("10000.0000"); // still gets its full 10%
    expect(r.leftover.toString()).toBe("65500.0000");
    expect(r.overAllocated).toBe(false);
  });

  it("fills by priority and clamps the loser when percentages exceed 100%", () => {
    const r = allocateBase(Money.of("50000"), "net", [
      { bucket: "brokerage", base: "net", pct: "0.6", priority: 1 },
      { bucket: "emergency", base: "net", pct: "0.6", priority: 2 },
    ]);
    const first = r.allocations.find((a) => a.bucket === "brokerage")!;
    const second = r.allocations.find((a) => a.bucket === "emergency")!;
    expect(first.amount.toString()).toBe("30000.0000");
    expect(second.amount.toString()).toBe("20000.0000"); // only 20k of pool left
    expect(second.clampedByBase).toBe(true);
    expect(r.leftover.toString()).toBe("0.0000");
    expect(r.overAllocated).toBe(true);
  });

  it("empty dials leave the whole base as leftover", () => {
    const r = allocateBase(Money.of("12345.6789"), "gross", []);
    expect(r.leftover.toString()).toBe("12345.6789");
    expect(r.allocations).toHaveLength(0);
  });
});

describe("allocateBase — invariant (property)", () => {
  it("Σ allocations + leftover == base for any dial set", () => {
    fc.assert(
      fc.property(
        fc.nat({ max: 100_000_000 }), // base in whole dollars
        fc.array(
          fc.record({
            pct: fc.integer({ min: 0, max: 10_000 }), // /10000 → [0,1]
            cap: fc.option(fc.nat({ max: 100_000_000 }), { nil: undefined }),
            priority: fc.integer({ min: 0, max: 50 }),
          }),
          { maxLength: 8 },
        ),
        (baseDollars, raw) => {
          const base = Money.of(String(baseDollars));
          const dials: DialInput[] = raw.map((d) => {
            const dial: DialInput = {
              bucket: "brokerage",
              base: "gross",
              pct: new Decimal(d.pct).div(10_000).toString(),
              priority: d.priority,
            };
            if (d.cap !== undefined) dial.annualCap = Money.of(String(d.cap));
            return dial;
          });
          const r = allocateBase(base, "gross", dials);
          const sum = r.allocations.reduce((s, a) => s.add(a.amount), Money.zero());
          return sum.add(r.leftover).equals(base);
        },
      ),
      { numRuns: 500 },
    );
  });
});
