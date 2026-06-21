# MAINSPRING — Frontend

Svelte 5 (runes) inside a Tauri 2 shell. The dials are the product; everything else frames them.

---

## 1. Structure

```
apps/desktop/
  src/                          # Svelte 5 frontend (webview)
    lib/
      stores/
        profile.svelte.ts       # $state: income, dials, accounts
        derived.svelte.ts       # $derived: recompute() output (net, buckets, FI)
        forecast.svelte.ts      # Monte Carlo results (via invoke)
      bridge/
        invoke.ts               # typed wrappers over Tauri commands
      charts/
        FanChart.svelte         # uPlot percentile bands
        Sparkline.svelte
    lib/components/
      Gauge.svelte              # THE dial: brass pressure-gauge, needle, glow
      DialConsole.svelte        # the grid of gauges = main screen
      TakeHomeReadout.svelte
      FireSummary.svelte        # FI date, Coast/Barista, savings rate
      ScenarioBar.svelte        # save / load / compare plans
    routes/                     # (or a tiny router; single-user, few screens)
  src-tauri/                    # Rust core
    src/
      commands/
        forecast.rs             # invoke("run_forecast")
        market.rs               # invoke("fetch_market")
        store.rs                # invoke("query"/"persist") against PGlite
      lib.rs
    tauri.conf.json
```

The shared `Gauge` and money-format helpers live in `packages/ui` so a future web build reuses them.

---

## 2. Reactivity model (why Svelte 5 fits)

The whole UI is "dial position → derived numbers." Runes express that directly:

```ts
// stores/profile.svelte.ts
export const profile = $state<ProfileState>(loadInitial());

// stores/derived.svelte.ts
import { recompute } from "@mainspring/engine";
export const view = $derived(recompute(profile));   // net, buckets, FI date — recomputed automatically
```

Drag a gauge → `profile.dials[i].pct` mutates → `view` recomputes synchronously via the TS engine → gauges and readouts update the same frame. No effects, no network, no reconciliation. (See [`MONEY_ENGINE.md`](./MONEY_ENGINE.md) §2.)

Constraints (caps, "can't exceed 100% of base") are enforced where the mutation happens, so an illegal drag is prevented rather than corrected after the fact.

---

## 3. The `Gauge` component

The signature element — a brass pressure gauge standing in for a percentage dial:

- SVG face with etched tick marks; a needle that sweeps as `pct` changes; the controlled bucket's live dollar amount under the face.
- Interactions: drag the needle, scroll, or arrow-key for fine control; keyboard-accessible.
- States via tokens (see [`DESIGN_SYSTEM.md`](./DESIGN_SYSTEM.md)): brass normal, verdigris/patina when a cap is hit (clamped), oxblood when an outflow (tax) is what it represents, gilt highlight on the active gauge.
- Build it once; instantiate per bucket in `DialConsole`.

---

## 4. Heavy work crosses to Rust

Only three things leave the webview, all via typed `invoke` wrappers:

```ts
// lib/bridge/invoke.ts
export const runForecast = (s: Scenario) => invoke<Forecast>("run_forecast", { s });
export const fetchMarket  = (t: string[]) => invoke<void>("fetch_market", { tickers: t });
export const persist      = (p: ProfileState) => invoke<void>("persist", { p });
```

Forecast results land in `forecast.svelte.ts` and render in `FanChart`. Everything else stays in-process.

---

## 5. Charts

- **`FanChart`** wraps uPlot: x = years, shaded p10–p90 band, bright p50 median, a marker where median crosses the FI number. uPlot handles the point density at 60fps.
- Observable Plot for secondary visuals (allocation breakdown, contribution history).
- Format money with the shared `Money` helper so on-screen rounding matches the engine.
