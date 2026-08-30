/**
 * Colors for the sub-slices of a breakdown line — spending categories, bill
 * labels, goal names. Unlike the top-level slices (Taxes, Investing…) these
 * names are arbitrary and open-ended, so they can't be enumerated in a map.
 *
 * A name hashes to a fixed spot in the shop palette, so "dining" reads the same
 * color wherever it appears. Two names landing on the same spot within one bar
 * would be indistinguishable, so collisions probe forward to the next free
 * color; past a full palette the cycle repeats, which is fine — a bar with nine
 * segments is read by its detail rows, not by color alone.
 */
const PALETTE = [
  "var(--color-brass)",
  "var(--color-patina)",
  "var(--color-copper)",
  "var(--color-lime-rust)",
  "var(--color-oxblood)",
  "var(--color-gilt)",
  "var(--color-soot)",
  "var(--color-dim)",
];

/** FNV-1a — small, stable across runs, and no dependency. */
function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/** Map each name to a palette color, unique within the set while one is free. */
export function subColors(names: string[]): Record<string, string> {
  const taken = new Set<number>();
  const out: Record<string, string> = {};
  for (const name of names) {
    const start = hash(name.toLowerCase()) % PALETTE.length;
    let i = start;
    while (taken.has(i) && taken.size < PALETTE.length) i = (i + 1) % PALETTE.length;
    taken.add(i);
    out[name] = PALETTE[i]!;
  }
  return out;
}
