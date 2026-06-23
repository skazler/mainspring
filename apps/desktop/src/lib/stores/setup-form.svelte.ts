import { defaultSetupForm } from "$lib/setup-map";

/** The setup form model — shared so loading from PGlite can pre-fill it. */
export const setupForm = $state(defaultSetupForm());
