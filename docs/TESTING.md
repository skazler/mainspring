# MAINSPRING — Testing

The engine is pure, so most of the value comes from cheap, fast, deterministic tests. Money correctness is non-negotiable.

---

## Tax — golden tests
`packages/engine/tests/tax/golden/`. Hand-computed scenarios (single TX W2 at several incomes, with/without pre-tax contributions) pinned to the cent for federal/FICA/net. **Any constant change requires a deliberate golden update.** This is the firewall against silently wrong take-home math. Run in CI on every change.

## Allocation — example + property
- Example tests for caps, priority, and clamp routing.
- Property tests (`fast-check`): within a shared base, bucket percentages never sum past 100%; capped buckets never exceed their limit; `Σ allocated + leftover == base` exactly, for random valid dial sets.

## Projection — property + regression
- Invariants: more savings ⇒ FI date never later; higher σ ⇒ wider bands; `p10 ≤ p50 ≤ p90` always.
- Regression: a fixed-seed Monte Carlo reference output pinned so refactors of the Rust kernel are detectable. Seed the RNG — same inputs must give the same paths.

## Kernel — `cargo test`
Unit tests on the Rust sim: distribution sampling, contribution/withdrawal folding, percentile extraction. A property test that GBM with σ=0 reduces exactly to deterministic compounding.

## Persistence — round-trip
PGlite migrations apply cleanly; entities round-trip with exact decimals; old scenario JSONB blobs upgrade on read.

## UI — E2E (Playwright)
The dial loop: drag a gauge → assert take-home and FI date update in the same interaction; assert an over-cap drag is prevented and shows the clamp state.

## Determinism everywhere
No `Date.now()` or RNG inside pure math — clock and seed are injected. This keeps tests stable, runs reproducible, and forecast caching valid.
