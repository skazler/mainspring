/**
 * The Calibre's fixed catalog of asset classes (docs/CALIBRE_REGISTERS.md §1).
 *
 * The Calibre designs an asset-class MIX, never individual stocks. Each class has
 * a proxy ticker that feeds the existing Yahoo → PGlite → annualizedStats pipeline
 * for live μ/σ, and a documented long-run **real** fallback so the tool works
 * offline on day one.
 *
 * ⚠ VERIFY before trusting. These fallbacks are rough long-run *real* (inflation-
 * adjusted) annual assumptions, in the spirit of published capital-market
 * assumptions (Vanguard/Research Affiliates 10-yr, historical real returns). They
 * are planning inputs, NOT predictions — edit them here to pin your own. Stored as
 * decimal strings to stay in the exact-Money discipline at the boundary.
 */

export type AssetClassId = "us_total" | "us_large" | "intl_dev" | "emerging" | "bonds" | "reits" | "cash";

export interface AssetClass {
  id: AssetClassId;
  label: string;
  /** Proxy for live stats; null when no series applies (cash). */
  proxyTicker: string | null;
  /** Long-run real annual return (decimal string). */
  fallbackMu: string;
  /** Long-run annual volatility (decimal string). */
  fallbackSigma: string;
  /** Broad bucket for the documented default-correlation fallback. */
  kind: "equity" | "bond" | "real-asset" | "cash";
}

export const ASSET_CLASSES: readonly AssetClass[] = [
  { id: "us_total", label: "US total market", proxyTicker: "VTI", fallbackMu: "0.055", fallbackSigma: "0.16", kind: "equity" },
  { id: "us_large", label: "US large cap (S&P 500)", proxyTicker: "FXAIX", fallbackMu: "0.055", fallbackSigma: "0.155", kind: "equity" },
  { id: "intl_dev", label: "International developed", proxyTicker: "VXUS", fallbackMu: "0.05", fallbackSigma: "0.17", kind: "equity" },
  { id: "emerging", label: "Emerging markets", proxyTicker: "VWO", fallbackMu: "0.055", fallbackSigma: "0.22", kind: "equity" },
  { id: "bonds", label: "US bonds", proxyTicker: "BND", fallbackMu: "0.01", fallbackSigma: "0.05", kind: "bond" },
  { id: "reits", label: "REITs", proxyTicker: "VNQ", fallbackMu: "0.045", fallbackSigma: "0.19", kind: "real-asset" },
  { id: "cash", label: "Cash", proxyTicker: null, fallbackMu: "0", fallbackSigma: "0.01", kind: "cash" },
];

const BY_ID = new Map(ASSET_CLASSES.map((c) => [c.id, c]));

export function assetClass(id: AssetClassId): AssetClass {
  const c = BY_ID.get(id);
  if (!c) throw new RangeError(`unknown asset class: ${id}`);
  return c;
}

/**
 * Documented default correlation between two classes, used only when at least one
 * lacks a live series (§2). Same-kind equities move together (0.85); equity↔bond
 * is treated as uncorrelated (0); everything else a mild 0.3. A class with itself
 * is 1. These are deliberately coarse — the point is not to pretend precision.
 */
export function defaultCorrelation(a: AssetClassId, b: AssetClassId): number {
  if (a === b) return 1;
  const ka = assetClass(a).kind;
  const kb = assetClass(b).kind;
  if (ka === "equity" && kb === "equity") return 0.85;
  if ((ka === "equity" && kb === "bond") || (ka === "bond" && kb === "equity")) return 0;
  if (ka === "cash" || kb === "cash") return 0;
  return 0.3;
}
