import { describe, expect, it } from "vitest";
import { subColors } from "./subcolors";

describe("subColors", () => {
  it("gives a name the same color wherever it appears", () => {
    expect(subColors(["dining"])["dining"]).toBe(subColors(["dining"])["dining"]);
    // Same name in a different bar, alone, keeps its slot.
    expect(subColors(["dining", "rent"])["dining"]).toBe(subColors(["dining"])["dining"]);
  });

  it("is case-insensitive", () => {
    expect(subColors(["Dining"])["Dining"]).toBe(subColors(["dining"])["dining"]);
  });

  it("never repeats a color within one bar while the palette has room", () => {
    const names = ["dining", "groceries", "rent", "utilities", "insurance", "car", "phone", "other"];
    const colors = Object.values(subColors(names));
    expect(new Set(colors).size).toBe(names.length);
  });

  it("returns a color for every slice, even past a full palette", () => {
    const names = Array.from({ length: 12 }, (_, i) => `cat ${i}`);
    const out = subColors(names);
    expect(Object.keys(out)).toHaveLength(12);
    for (const n of names) expect(out[n]).toMatch(/^var\(--color-/);
  });
});
