import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * `step` on a number input is not a UI hint — it is a validation constraint.
 * A value that isn't a whole multiple of it fails `stepMismatch`, the browser
 * refuses the form with "enter a valid value", and there is no in-app clue why.
 *
 * That shipped: Setup's benefit-premium field carried step="5" and rejected
 * $166 off a pay stub; "Invested assets today" carried step="1000" and would
 * have rejected a $14,971 balance. Both are figures a user copies verbatim
 * from a statement, and neither is round.
 *
 * So: money and rate inputs take step="any". Counts (age) may keep an integer
 * step, since a fractional age is genuinely invalid rather than merely unround.
 */
const COMPONENTS = join(__dirname, "components");

/** Fields where a non-round value is normal and must be accepted verbatim. */
const INTEGER_ONLY = /currentAge|targetRetireAge/;

function svelteFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
    e.isDirectory() ? svelteFiles(join(dir, e.name)) : e.name.endsWith(".svelte") ? [join(dir, e.name)] : [],
  );
}

describe("number inputs don't reject unround real-world values", () => {
  const inputs = svelteFiles(COMPONENTS).flatMap((file) => {
    const src = readFileSync(file, "utf8");
    return [...src.matchAll(/<input\b[^>]*type="number"[^>]*>/g)].map((m) => {
      const tag = m[0];
      const line = src.slice(0, m.index).split("\n").length;
      return {
        where: `${file.slice(file.lastIndexOf("/") + 1)}:${line}`,
        step: /step="([^"]*)"/.exec(tag)?.[1],
        tag,
      };
    });
  });

  it("finds the number inputs to check", () => {
    expect(inputs.length).toBeGreaterThan(10);
  });

  it.each(inputs.map((i) => [i.where, i]))("%s accepts arbitrary values", (_where, input) => {
    const { step, tag } = input as (typeof inputs)[number];
    if (INTEGER_ONLY.test(tag)) {
      // An integer step is the point here; just make sure it isn't coarser.
      expect(step === undefined || step === "1").toBe(true);
      return;
    }
    expect(step, `${input.where} must use step="any" — a numeric step silently rejects values that aren't multiples of it`).toBe("any");
  });
});
