import { buildProfileState } from "$lib/setup-map";
import { loadSetupForm } from "$lib/db";
import { applySetup } from "./profile.svelte";
import { markSetupSaved, setupForm } from "./setup-form.svelte";
import { market } from "./market.svelte";
import { almanac } from "./almanac.svelte";
import { spending } from "./spending.svelte";
import { goals } from "./goals.svelte";
import { recurring } from "./recurring.svelte";

/**
 * Session UI state. `configured` gates the setup page vs. the dial console;
 * `loaded` is false until we've checked PGlite for a saved profile.
 */
export const session = $state<{
  configured: boolean;
  loaded: boolean;
  /** true once a profile has ever been saved — gates the setup "Back" button. */
  hasProfile: boolean;
  tab: "plan" | "holdings" | "spending" | "goals";
}>({
  configured: false,
  loaded: false,
  hasProfile: false,
  tab: "plan",
});

/** Reject after `ms` so a hung DB never freezes startup. */
function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  return Promise.race([
    p,
    new Promise<T>((_, reject) => setTimeout(() => reject(new Error("db timeout")), ms)),
  ]);
}

/**
 * On startup: restore a saved profile if one exists, else fall through to setup.
 * The UI must always reach a usable state — a slow/failed local DB can't leave us
 * stuck on the loading screen, so the only blocking read is time-boxed and the
 * rest load in the background.
 */
export async function initSession(): Promise<void> {
  try {
    const saved = await withTimeout(loadSetupForm(), 4000);
    if (saved) {
      Object.assign(setupForm, saved);
      markSetupSaved();
      applySetup(buildProfileState(saved));
      session.configured = true;
      session.hasProfile = true;
    }
  } catch {
    // DB unavailable or slow — fall through to setup; the app still runs in memory.
  }
  session.loaded = true;

  // Non-blocking secondary loads.
  void market.loadCached().catch(() => {});
  void almanac.loadKey().catch(() => {});
  void spending.load().catch(() => {});
  void goals.load().catch(() => {});
  void recurring.load().catch(() => {});
}
