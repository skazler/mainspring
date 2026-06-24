# MAINSPRING

[![CI](https://github.com/skazler/mainspring/actions/workflows/ci.yml/badge.svg)](https://github.com/skazler/mainspring/actions/workflows/ci.yml)

> A private, offline-first financial independence/retire early planner.
> You wind it up — and it drives everything.
>
> Behind the name **MAINSPRING**: the coiled spring that stores energy and releases it steadily to power a mechanical watch.

Single-user. Local-first. Privacy-critical (this holds your real money, so by default your data never leaves a machine you control). Built around **dials** — drag a percentage, watch take-home, every allocation bucket, and your projected freedom date move in real time.

---

## What this is

A desktop app (Tauri) where the entire money model — tax, allocations, projections — is one shared TypeScript engine that runs instantly on-device, persisted to a local Postgres-compatible store, with a Rust simulation kernel for Monte Carlo forecasting. No server required. No round-trip to move a dial.

## Stack at a glance

| Concern | Choice |
|---|---|
| App shell | Tauri 2 (Rust) — native, tiny, private |
| UI | Svelte 5 (runes) + TypeScript + Vite |
| Money/tax/allocation logic | **Isomorphic TypeScript engine** (one source of truth) |
| Simulation kernel | Rust → native (desktop) / WASM (web) |
| Local store | PGlite (Postgres in-process) + DuckDB (analytics) |
| ORM / migrations | Drizzle |
| Validation | Zod |
| Charts | uPlot + Observable Plot |
| Styling | Tailwind v4 + steampunk token layer |
| Market data | yfinance + Finnhub (both free) |
| Optional sync | ElectricSQL → self-hosted Postgres (multi-device only) |
| Optional AI | general planning assistant (Q&A + NL→validated dial changes) via your own Anthropic key |

## Doc index (handled by agents)

| File | For the agent building… |
|---|---|
| [`ARCHITECTURE.md`](./docs/ARCHITECTURE.md) | system overview, diagrams, full stack, scaling & longevity, repo layout |
| [`DOMAIN_MODEL.md`](./docs/DOMAIN_MODEL.md) | entities, ER diagram, money-handling rules |
| [`MONEY_ENGINE.md`](./docs/MONEY_ENGINE.md) | the isomorphic TS core: cashflow + tax + allocation |
| [`STOCK_MANAGEMENT.md`](./docs/STOCK_MANAGEMENT.md) | positions as a lot ledger, valuation, capital-gains tax |
| [`PREDICTION_ENGINE.md`](./docs/PREDICTION_ENGINE.md) | deterministic + Monte Carlo + FIRE metrics + Rust kernel + optional ML |
| [`DATA_LAYER.md`](./docs/DATA_LAYER.md) | PGlite + DuckDB, persistence, market data, optional sync |
| [`FRONTEND.md`](./docs/FRONTEND.md) | Svelte 5 + Tauri, the dial component, live recompute |
| [`DESIGN_SYSTEM.md`](./docs/DESIGN_SYSTEM.md) | steampunk design tokens, gauges, type |
| [`AI_WORKFLOWS.md`](./docs/AI_WORKFLOWS.md) | how to build it *with* agents + optional in-app AI |
| [`BUILD_PLAN.md`](./docs/BUILD_PLAN.md) | phased milestones with acceptance criteria |
| [`TESTING.md`](./docs/TESTING.md) | golden + property + E2E strategy |
| [`COSTS.md`](./docs/COSTS.md) | running-cost breakdown ($0 local) |

## Quickstart

```bash
pnpm install
pnpm tauri dev        # launches the desktop app (local PGlite store)
pnpm test             # vitest (schema + engine + app)
cargo test --workspace # Rust kernel + market parser
pnpm lint && pnpm typecheck
pnpm --filter desktop tauri build   # packaged MAINSPRING.app
```

First run shows a **setup page** (income, taxes, contributions); it persists locally and the dial console follows.

## Build status

Phases 0–8 of [`BUILD_PLAN.md`](./docs/BUILD_PLAN.md) are implemented, plus the optional AI copilot.

| Area | State |
|---|---|
| Workspace + Tauri/Svelte 5 app, CI | ✅ |
| Schema + `Money` (decimal.js) + PGlite | ✅ |
| Tax engine (federal + FICA + TX, 2026) | ✅ golden-tested |
| Positions + capital gains (lots, FIFO/spec-ID, NIIT) | ✅ engine + holdings UI |
| Cashflow + allocation + `recompute` | ✅ property-tested |
| Deterministic projection + steampunk gauges | ✅ |
| Monte Carlo kernel (Rust) + fan chart | ✅ |
| Market data (yfinance → PGlite, μ/σ) | ✅ |
| Setup/onboarding + persistence | ✅ |
| Scenarios (save/load/compare) | ✅ |
| Stock trend estimations (per-holding fan chart) | ✅ |
| Theme polish + packaged `.app` build | ✅ |
| AI assistant (plan Q&A + NL → validated dial changes) | ✅ (bring your own Anthropic key) |
| Multi-device sync (ElectricSQL) | scaffold only — [`infra/sync`](./infra/sync) |

Known follow-ups: macOS code-signing (needs an Apple Developer cert), Finnhub live quotes (needs a key), normalized persistence (currently JSON snapshots), a full buy/sell lot-ledger UI, and end-to-end sync wiring.

## Non-negotiables

1. Money is never a float. `Decimal` end-to-end, exact in the DB.
2. The money engine is pure and framework-free — it outlives any UI, DB, or shell choice.
3. Your financial data stays local by default. Nothing is sent anywhere without an explicit opt-in.
