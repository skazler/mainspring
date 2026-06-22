/**
 * Session UI state. `configured` gates the setup page vs. the dial console.
 * (In-memory for now; persistence to PGlite lands with the data layer.)
 */
export const session = $state({ configured: false });
