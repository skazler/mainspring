import { constrainPct, remainingPct, type ProfileState } from "@mainspring/engine";
import { buildProfileState, defaultSetupForm } from "$lib/setup-map";

export const profile = $state<ProfileState>(buildProfileState(defaultSetupForm()));

/** Replace the whole profile from a freshly-built state (setup submit). */
export function applySetup(next: ProfileState): void {
  profile.incomeSources = next.incomeSources;
  profile.annualExpenses = next.annualExpenses;
  profile.taxProfile = next.taxProfile;
  profile.plan = next.plan;
  profile.dials = next.dials;
}

/**
 * Set a dial's fraction, enforcing the "can't exceed 100% of base" constraint at
 * the point of mutation so an illegal drag is *prevented*, not corrected after.
 */
export function setDialPct(index: number, proposed: number): void {
  const dial = profile.dials[index];
  if (!dial) return;
  dial.pct = constrainPct(String(proposed), remainingPct(profile.dials, dial.base, index));
}
