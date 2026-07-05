/**
 * Fixed RNG seed for the Monte Carlo kernel (F22). Same inputs → same fan, so a
 * forecast is reproducible across runs and screenshots. One definition, imported
 * by every forecast call site. (A "re-roll" affordance could vary it later.)
 */
export const FORECAST_SEED = 42;
