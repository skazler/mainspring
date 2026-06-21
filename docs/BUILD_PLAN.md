# MAINSPRING — Build Plan

Phased milestones, each self-contained with a definition of done. Hand an agent one phase at a time; the acceptance criteria are its test.

| Phase | Deliverable | Done when |
|---|---|---|
| **0. Scaffold** | pnpm workspace; `packages/{engine,schema,ui}`, `crates/sim`, `apps/desktop` (Tauri); CI runs Vitest + `cargo test`; `AGENTS.md` with version pins | `pnpm tauri dev` opens an empty app; `pnpm test` + `cargo test` green in CI |
| **1. Schema + money types** | Drizzle tables + Zod schemas in `packages/schema`; `Money` (dinero) value object + lint rule banning float money; PGlite migration | migrations apply to PGlite; a profile + accounts round-trip with exact decimals |
| **2. Tax engine** | `engine/tax` (federal, FICA, TX state=0), 2026 constants, golden tests | golden scenarios pass to the cent; effective + marginal rate returned |
| **3. Cashflow + allocation** | annualize income; dials → bucket dollars with caps + priority + clamps; `recompute()` entry point | given a dial set, per-bucket contributions + leftover are correct, cap-respecting; `Σ allocated + leftover == base` property test passes |
| **4. Deterministic projection + gauges** | `engine/fire`; `Gauge.svelte`, `DialConsole`, runes wiring (`$state`→`$derived`) | dragging a gauge updates take-home + FI date synchronously, same frame; constraints prevent illegal drags |
| **5. Rust kernel + fan chart** | `crates/sim` GBM + historical bootstrap, native + wasm targets, `invoke("run_forecast")`, `FanChart.svelte` | "Run forecast" returns p10/p50/p90 + success probability; withdrawal-phase (sequence) modeled; results cached by `inputs_hash` |
| **6. Market data** | Rust `fetch_market` (yfinance history + Finnhub quotes) → PGlite; μ/σ derivation; DuckDB analytics for history + path aggregation | history stored + refreshable; holdings show live value; simulator reads local only |
| **7. Scenarios** | save/load/diff dial states + forecasts; `ScenarioBar` | two plans save and compare side by side; old scenario blobs upgrade on read |
| **8. Theme + package** | full steampunk token system; gauges/needles polished; signed desktop build | app runs as a packaged desktop build on your machine, data fully local |
| **9 (optional). Multi-device sync** | ElectricSQL → self-hosted Postgres on Hetzner; PGlite read-sync | a second device mirrors the same data; offline still fully functional |
| **10 (optional). AI copilot** | NL→dial-state (structured output, Zod-validated); optional MCP server | a natural-language request produces a validated dial delta the engine applies; raw account data never leaves the device |

**Ordering note for agents:** phases 1–5 are the spine and must land in order (each depends on the prior contract). 6–8 can parallelize across agents once 5 is stable. 9–10 are independent opt-ins.
