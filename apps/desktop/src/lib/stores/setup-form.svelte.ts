import { defaultSetupForm } from "$lib/setup-map";

/** The setup form model — shared so loading from PGlite can pre-fill it. */
export const setupForm = $state(defaultSetupForm());

/** Serialized snapshot of the last saved/loaded form — for change detection. */
export const setupBaseline = $state({ json: JSON.stringify(defaultSetupForm()) });

/** Mark the current form as the saved baseline (after load or submit). */
export function markSetupSaved(): void {
  setupBaseline.json = JSON.stringify(setupForm);
}
