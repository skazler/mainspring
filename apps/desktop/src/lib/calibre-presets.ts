import type { AssetClassId } from "@mainspring/engine";
import { fullWeights } from "./setup-map";

/** A named starting-point mix; `weights` may depend on how far off the freedom date is. */
export interface Preset {
  name: string;
  character: string;
  weights: (yearsToFI: number | null) => Record<AssetClassId, string>;
}

export const PRESETS: readonly Preset[] = [
  {
    name: "Three-fund",
    character: "Classic total-market + international + bonds.",
    weights: () => fullWeights({ us_total: "0.54", intl_dev: "0.26", bonds: "0.2" }),
  },
  {
    name: "Equity engine",
    character: "90/10 — accumulation-phase, high variance.",
    weights: () => fullWeights({ us_total: "0.6", intl_dev: "0.3", bonds: "0.1" }),
  },
  {
    name: "All-weather-ish",
    character: "Broad diversification, calmer, lower expected return.",
    weights: () => fullWeights({ us_total: "0.3", intl_dev: "0.15", bonds: "0.4", reits: "0.1", cash: "0.05" }),
  },
  {
    name: "Glide",
    character: "Equity-heavy far from FI, bonds rising as the date nears — sequence-of-returns risk.",
    weights: (yearsToFI) => glide(yearsToFI),
  },
];

/** Equity fraction rises with the distance to FI (bonds take over as it nears). */
function glide(yearsToFI: number | null): Record<AssetClassId, string> {
  const years = yearsToFI ?? 20;
  const equity = Math.round(Math.max(30, Math.min(90, 40 + years * 2))); // percent
  const bonds = 100 - equity;
  const us = Math.round(equity * 0.66);
  const intl = equity - us;
  return fullWeights({ us_total: String(us / 100), intl_dev: String(intl / 100), bonds: String(bonds / 100) });
}
