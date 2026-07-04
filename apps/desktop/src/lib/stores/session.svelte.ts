import { buildProfileState } from "$lib/setup-map";
import { loadSetupForm } from "$lib/db";
import { applySetup } from "./profile.svelte";
import { setupForm } from "./setup-form.svelte";
import { market } from "./market.svelte";
import { almanac } from "./almanac.svelte";
import { spending } from "./spending.svelte";

/**
 * Session UI state. `configured` gates the setup page vs. the dial console;
 * `loaded` is false until we've checked PGlite for a saved profile.
 */
export const session = $state<{ configured: boolean; loaded: boolean; tab: "plan" | "holdings" | "spending" }>({
  configured: false,
  loaded: false,
  tab: "plan",
});

/** On startup: restore a saved profile if one exists, else fall through to setup. */
export async function initSession(): Promise<void> {
  const saved = await loadSetupForm();
  if (saved) {
    Object.assign(setupForm, saved);
    applySetup(buildProfileState(saved));
    session.configured = true;
  }
  await market.loadCached();
  await almanac.loadKey();
  await spending.load();
  session.loaded = true;
}
