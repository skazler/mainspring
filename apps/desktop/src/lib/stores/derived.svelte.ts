import { recompute, type RecomputeView } from "@mainspring/engine";
import { profile } from "./profile.svelte";

/**
 * The whole UI is "dial position → derived numbers." Mutating profile.dials[i].pct
 * re-runs recompute synchronously (no network, no IPC) so gauges and readouts
 * update the same frame. (FRONTEND §2.)
 *
 * Svelte 5 can't export `$derived` from a module directly, so we expose it as a
 * memoized field on a singleton: read `view.current`.
 */
class ViewStore {
  readonly current: RecomputeView = $derived(recompute(profile));
}

export const view = new ViewStore();
