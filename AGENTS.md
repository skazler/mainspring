# AGENTS.md — MAINSPRING build conventions

Source-of-truth instructions for any agent (or human) working in this repo.
Read this plus the relevant `docs/*.md` before touching a bounded context.

## Non-negotiables
1. **Money is never a float.** Exact decimals end-to-end, exact in the DB.
2. **The money engine is pure** — no framework, no I/O, no storage imports in `packages/engine`.
3. **Financial data stays local by default.** Nothing leaves the machine without explicit opt-in.

## Decisions (locked)
- **Decimal:** `decimal.js`-backed `Money` value object; penny-safe bucket splits use a dinero-style `allocate` algorithm. (Revisit only with a documented reason.)
- **Tax scope (Phase 2):** US federal + FICA + **Texas (state rate = 0)**. No general state engine yet.
- **Package manager:** pnpm workspace. Run everything from repo root.

## Toolchain (pinned)
| Tool | Version |
|---|---|
| Node | 24.x (>=22) |
| pnpm | 11.8.0 |
| Rust | 1.96 stable |
| Tauri | 2.x |
| Svelte | 5.x (runes) |
| Vite | 6.x |
| TypeScript | 5.6.x |

## Layout
See `docs/ARCHITECTURE.md §7`. Bounded contexts → packages:
- `packages/engine` — pure money math (cashflow, tax, allocation, fire metrics)
- `packages/schema` — Zod + Drizzle (shared types, system of record)
- `crates/sim` — Rust Monte Carlo kernel (native + wasm)
- `apps/desktop` — the Tauri app; UI components (incl. `<Gauge>`) live in
  `apps/desktop/src/lib/components` for now — extracting a shared `packages/ui`
  is a later refactor (ARCHITECTURE.md §7).

## Commands
- `pnpm tauri dev` — launch the desktop app (from repo root)
- `pnpm test` — Vitest across packages
- `cargo test` (in a crate) — Rust kernel tests

## How to work
- One phase at a time (`docs/BUILD_PLAN.md`); its acceptance criteria are the test.
- Phases 1–5 are a strict chain — don't start a phase until the prior contract is green.
- Personal/local notes go in `CLAUDE.local.md` (gitignored), never here.
