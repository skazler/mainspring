import { Money } from "@mainspring/schema";
import { constrainPct, remainingPct, type ProfileState } from "@mainspring/engine";

function initialProfile(): ProfileState {
  return {
    incomeSources: [{ grossAmount: Money.of("120000"), frequency: "annual" }],
    annualExpenses: Money.of("45000"),
    taxProfile: { filingStatus: "single", state: "TX", taxYear: 2026 },
    plan: {
      currentBalance: Money.of("150000"),
      swr: "0.04",
      realReturn: "0.05",
      currentAge: 32,
      targetRetireAge: 60,
    },
    dials: [
      { bucket: "401k_pretax", base: "gross", pct: "0.15", priority: 1, annualCap: Money.of("24500") },
      { bucket: "ira", base: "gross", pct: "0.05", priority: 2, annualCap: Money.of("7500") },
      { bucket: "brokerage", base: "post_tax_savings", pct: "0.3", priority: 3 },
      { bucket: "emergency", base: "post_tax_savings", pct: "0.1", priority: 4 },
    ],
  };
}

export const profile = $state<ProfileState>(initialProfile());

/**
 * Set a dial's fraction, enforcing the "can't exceed 100% of base" constraint at
 * the point of mutation so an illegal drag is *prevented*, not corrected after.
 */
export function setDialPct(index: number, proposed: number): void {
  const dial = profile.dials[index];
  if (!dial) return;
  dial.pct = constrainPct(String(proposed), remainingPct(profile.dials, dial.base, index));
}
