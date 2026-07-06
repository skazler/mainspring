import type { AssetClassId } from "@mainspring/engine";

/**
 * The explanation engine (docs/CALIBRE_REGISTERS.md §4). Mechanics, never advice —
 * what a lever *does* and why, never "you should." Every number a user acts on is
 * derived live from the current stats; nothing here hardcodes a return claim.
 */
export const CLASS_WHY: Record<AssetClassId, string> = {
  us_total: "The core equity engine: higher expected real return, wider bands. More here lifts both μ and σ.",
  us_large: "Large-cap US — close to total market, a touch less small-cap risk. Overlaps heavily with US total.",
  intl_dev: "Developed markets outside the US. Imperfectly correlated with US equity, so a slice can lower σ more than it lowers μ.",
  emerging: "Higher volatility and wider dispersion; a small weight moves μ a little and σ a lot.",
  bonds: "Ballast: damps volatility and sequence-of-returns risk near and after your freedom date, at a lower expected real return. Watch p10 lift on the fan chart as you add it.",
  reits: "A partial diversifier with equity-like drawdowns — an optional slice.",
  cash: "σ≈0 and ~0% real: a drag while accumulating, ballast while drawing down.",
};

export const DIVERSIFICATION_WHY =
  "These slices don't all move together, so the mix is calmer than its parts — portfolio σ sitting below the weighted-average σ is the diversification benefit made visible.";
