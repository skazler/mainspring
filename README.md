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
| Optional AI | local NL→dial copilot, MCP server for agent control |

## Doc index (handled by agents)

| File | For the agent building… |
|---|---|
| [`ARCHITECTURE.md`](./ARCHITECTURE.md) | system overview, diagrams, full stack, scaling & longevity, repo layout |
| [`DOMAIN_MODEL.md`](./DOMAIN_MODEL.md) | entities, ER diagram, money-handling rules |
| [`MONEY_ENGINE.md`](./MONEY_ENGINE.md) | the isomorphic TS core: cashflow + tax + allocation |
| [`PREDICTION_ENGINE.md`](./PREDICTION_ENGINE.md) | deterministic + Monte Carlo + FIRE metrics + Rust kernel + optional ML |
| [`DATA_LAYER.md`](./DATA_LAYER.md) | PGlite + DuckDB, persistence, market data, optional sync |
| [`FRONTEND.md`](./FRONTEND.md) | Svelte 5 + Tauri, the dial component, live recompute |
| [`DESIGN_SYSTEM.md`](./DESIGN_SYSTEM.md) | steampunk design tokens, gauges, type |
| [`AI_WORKFLOWS.md`](./AI_WORKFLOWS.md) | how to build it *with* agents + optional in-app AI |
| [`BUILD_PLAN.md`](./BUILD_PLAN.md) | phased milestones with acceptance criteria |
| [`TESTING.md`](./TESTING.md) | golden + property + E2E strategy |
| [`COSTS.md`](./COSTS.md) | running-cost breakdown ($0 local) |

## Quickstart (target state)

```bash
pnpm install
pnpm tauri dev        # launches the desktop app with a local PGlite store
pnpm test             # vitest (engine) + cargo test (kernel)
```

## Non-negotiables

1. Money is never a float. `Decimal` end-to-end, exact in the DB.
2. The money engine is pure and framework-free — it outlives any UI, DB, or shell choice.
3. Your financial data stays local by default. Nothing is sent anywhere without an explicit opt-in.
