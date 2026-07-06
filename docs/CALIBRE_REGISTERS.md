# MAINSPRING — The Calibre & The Registers

Design + build plan for growing the Holdings tab into two instruments:

- **The Calibre** — a portfolio *design* tool. You don't pick stocks; you tune an asset mix
  (equity/bond ratio, US/international split, and so on) with the same gauges as the Plan tab,
  see expected real return, volatility, and Monte-Carlo success probability move on the same
  tick, and read *why* each lever matters. The chosen calibre becomes the return assumption
  behind the Plan's projection — it *is* the scenario.
- **The Registers** — tracking what you *actually* hold: the existing lot ledger, regrouped by
  asset class, compared against the calibre's targets, with drift flags, a tax-aware rebalance
  helper, and a Monte-Carlo projection of the real portfolio.

Naming (horology, consistent with the case/mainspring/escapement/vault/almanac set):
a **calibre** is the designed movement — the blueprint a watch is built to. **Registers** are a
chronograph's subdials — the small dials that track what's actually elapsed. Design vs. record.
(Runner-up for the tracking side: **The Caseback** — the exhibition window you look through to
see the real movement running. Use it if "Registers" reads too fiscal.)

Tab layout after this lands: `Plan · Calibre · Registers · Outflows · Goals`
(the current Holdings tab becomes Registers; the auto-contributions block stays there).

**Prerequisites:** FIXES.md F3 (GBM drift parameterization) and F4 (real-vs-nominal returns)
must land first. This feature's whole job is explaining risk/return numbers; it cannot ship on
top of a kernel whose σ=0 median disagrees with the deterministic projection or whose μ mixes
inflation bases.

**Stance (non-negotiable):** this is a modeling instrument, not advice. Every readout that
depends on assumptions carries the existing disclaimer style. The tool explains *mechanics and
trade-offs* (what a lever does and why), never "you should." The Almanac may narrate a calibre
using the same derived-numbers-only rule it already follows.

---

## 1. Concepts & data model

### Asset classes, not tickers
The Calibre operates on a small fixed catalog of asset classes. Each class carries:

| Field | Example |
|---|---|
| `id` | `us_total`, `us_large`, `intl_dev`, `emerging`, `bonds`, `reits`, `cash` |
| `label` | "US total market" |
| `proxyTicker` | VTI, FXAIX, VXUS, VWO, BND, VNQ, — |
| `fallbackMu` / `fallbackSigma` | documented long-run **real** annual assumptions (string decimals) |
| `why` | one-paragraph mechanics blurb (see §4) |

Proxy tickers feed the existing Yahoo→PGlite→`annualizedStats` pipeline so μ/σ/correlations come
from local history when available; `fallback*` makes the tool fully functional offline on day
one. Fallbacks live in one constants module with sources cited in comments, same discipline as
`tax/constants/2026.ts` ("VERIFY before trusting").

### The calibre itself
A calibre = `{ name, weights: Record<AssetClassId, rateString> }`, weights summing to 1
(enforced with `remainingPct`/`constrainPct` — the constraint machinery already exists).
It is stored **inside `SetupForm`** (`form.calibre`), so scenario save/load/compare
(`ScenarioBar`) picks it up for free, and `normalizeSetupForm` backfills a default for older
saved forms. No new top-level table.

### Ticker → class mapping (for the Registers)
New table `ticker_classes (ticker text primary key, class_id text not null)`, via a
`packages/schema` migration per FIXES F10 discipline. Seed the proxy tickers; unknown tickers
prompt a one-time "what is this?" class picker in the Registers UI and remember the answer.

---

## 2. Engine additions (`packages/engine/src/market/portfolio.ts`)

Pure, `number`-based statistics (consistent with the existing note in `stats.ts`: rates, not
currency). All functions take data in; nothing reads the DB.

1. `alignedReturns(seriesByAsset: Record<id, {date, close}[]>): Record<id, number[]>`
   — intersect on shared dates, then period returns. Refuse (return null) below a minimum
   overlap (e.g. 252 observations) so a thin series can't masquerade as signal.
2. `covarianceMatrix(returns): number[][]` — sample covariance (n−1), annualized ×252.
3. `portfolioStats(weights, mus, cov): { mu, sigma }` — μ = Σwᵢμᵢ; σ = √(wᵀΣw).
   This is the point of the whole feature: the diversification benefit (portfolio σ below the
   weighted-average σ when correlations < 1) falls out of the math and becomes *visible* on the
   gauge, which is the best "why" there is.
4. `blendWithFallbacks(weights, live, fallbacks)` — per-class: use live stats when the series
   clears the overlap bar, else the documented fallback; return which classes used which, so
   the UI can badge "historical" vs "assumed" per slice. Correlations involving a fallback
   class use a documented default (0.85 equity–equity, 0 equity–bond) rather than pretending.

**Tests:** hand-computed 2-asset covariance golden; property (fast-check): σ_portfolio ≤
Σwᵢσᵢ for any valid weights when the cov matrix is PSD; weights summing ≠ 1 rejected;
two perfectly correlated assets give exactly the weighted σ.

---

## 3. The Calibre (design view)

Layout, top to bottom:

1. **Preset shelf** — cards, each a named calibre with its weights and a one-line character:
   - *Three-fund* (classic total-market/international/bond)
   - *Equity engine* (90/10 — accumulation-phase, high variance)
   - *Glide* (equity fraction derived from `yearsToFI`: equity-heavy far out, bonds rising as
     the freedom date approaches — the card explains sequence-of-returns risk, which the
     kernel *already models* through the withdrawal phase; this preset is where that shows)
   - *All-weather-ish* (broad diversification, lower σ, lower μ)
   Clicking a preset loads its weights into the gauges; it's a starting point, not a lock.
2. **Weight gauges** — one `<Gauge>` per asset class, same component and the same shared-base
   100% constraint as the Plan dials. Turning one re-runs `portfolioStats` synchronously —
   the "same tick" rule applies here too.
3. **Readout strip** — expected real return (μ), volatility (σ), and two derived,
   plain-language framings: "a typical bad year ≈ −{1.28σ−μ}%" and the MC success probability
   for the *current plan* under this calibre (debounced kernel run, since it crosses IPC).
   Show a **delta** against the currently-applied calibre: "+0.4%/yr expected · −3.1% typical
   bad year · success 84% → 87%". Deltas are the explanation engine — show, then tell.
4. **The "why" rail** — `hints`-gated blurbs per lever (see §4), plus a per-slice badge for
   historical vs assumed stats (from `blendWithFallbacks`).
5. **Apply** — "Fit this calibre" writes it to `form.calibre`, marks the form dirty, and the
   Plan tab's forecast now runs on the blended μ/σ. `ScenarioBar` diff columns gain
   `calibre μ/σ` so two saved plans compare portfolio designs side by side.

**Plan integration:** `forecast.svelte.ts` swaps its μ/σ source order to:
calibre-blended stats → single-ticker market store (kept as legacy fallback) →
`realReturn` assumption. One place, clearly commented.

---

## 4. The explanation engine ("why")

Static, versioned copy in one module (`apps/desktop/src/lib/calibre-why.ts`), one entry per
lever, written as mechanics not recommendations. The required set:

- **Equity/bond ratio** — equities: higher expected real return, wider bands; bonds: damp σ and
  sequence-of-returns risk near/after the freedom date. Point at the fan chart: "watch p10."
- **US/international split** — single-country concentration vs. imperfect correlation; the σ
  reduction is visible in the readout when the slider moves, cite that.
- **Emerging markets** — higher σ and higher dispersion; small weights move μ little and σ a lot.
- **REITs** — partial diversifier, equity-like drawdowns; optional slice.
- **Cash** — σ≈0, μ≈0 real; drag during accumulation, ballast in decumulation.
- **The diversification line** — a standing note under the σ readout whenever portfolio σ <
  weighted-average σ: "these slices don't move together; the mix is calmer than its parts."

Every figure in the copy is derived live from the current stats — no hardcoded return claims.
Almanac hookup: extend the context object with `{ calibre: weights, portfolio: {mu, sigma} }`
(ratios only — still no dollars) so "why is my success probability low?" can reference the mix.

---

## 5. The Registers (tracking view)

Rework of `Holdings.svelte`, keeping the lot ledger and auto-contributions blocks, adding:

1. **Class grouping** — positions rolled up by asset class via `ticker_classes`; unknown
   tickers get the one-time class picker.
2. **Target vs actual** — per class: actual weight (market value / total) beside the calibre's
   target weight, as paired bars. Drift flag at ±5 percentage points absolute (the classic
   band; make the threshold a named constant).
3. **Rebalance helper (tax-aware — this is the flagship)** — for drifted classes, in order:
   a. "Direct new contributions here" — compute the months of current auto-invest +
      post-tax-savings flow needed to close the gap without selling anything.
   b. If selling is the only path, dry-run the sale through the *existing* engine:
      `realizeSale` (FIFO or spec-ID) → realized ST/LT split → `computeCapitalGainsTax` →
      "closing this drift by selling costs ≈ $X in tax; contributions close it free in ~N
      months." Nothing new to build — this meshes the lot ledger, capgains engine, and
      recompute view that already exist. Tax-advantaged accounts (once account linkage lands
      per FIXES F10/F11) show $0 tax cost and get suggested first.
4. **Portfolio projection** — one fan chart for the whole real portfolio: actual weights →
   `blendWithFallbacks` → kernel, with `annualContribution` = current auto-invest + the plan's
   contribution flow routed by the calibre's weights. The per-ticker "Project" button stays for
   single-holding curiosity, but the portfolio fan is the headline.
5. **Drift-vs-design framing** — one line at the top: "Your registers read X; the calibre is
   designed for Y" with the largest drift named. Same voice as the Outflows verdict.

---

## 6. Build phases (hand an agent one at a time)

| Phase | Deliverable | Done when |
|---|---|---|
| **C1. Portfolio math** | `market/portfolio.ts` (aligned returns, covariance, portfolioStats, blendWithFallbacks) + asset-class catalog with documented real-return fallbacks | golden 2-asset covariance test; fast-check diversification property; fallback badging unit-tested |
| **C2. Schema & form** | `calibre` in `SetupForm` (+ `normalizeSetupForm` backfill); `ticker_classes` migration in `packages/schema`; scenario snapshots carry the calibre | round-trip test: save/load a scenario preserves weights exactly; old saved forms load with the default calibre |
| **C3. Calibre view** | preset shelf, weight gauges on the shared-100% constraint, live readout strip with deltas, why-rail, Fit button | turning a gauge updates μ/σ same tick; MC success delta debounced; Σweights can't exceed 1 by drag |
| **C4. Plan integration** | forecast μ/σ sourced from the applied calibre; ScenarioBar diff shows calibre μ/σ; Almanac context gains ratios | two scenarios with different calibres show different success probabilities and diff columns; no dollar figures added to the Almanac payload |
| **C5. Registers view** | class grouping + picker, target-vs-actual bars, drift flags, rebalance helper (contribution path + tax-cost dry-run), portfolio fan chart | a drifted synthetic portfolio shows the drift, a correct months-to-close figure, and a to-the-cent tax estimate matching a hand-computed golden |
| **C6. Theme & copy pass** | tab renames (Calibre/Registers), hints copy, disclaimers on every assumption-bearing readout | every number a user can act on carries either a live derivation or the estimate disclaimer |

**Explicitly out of scope:** individual-stock picking or screening (the catalog is asset
classes by design), tax-loss-harvesting automation, factor tilts (a later preset at most),
and any "recommended for you" defaults beyond the glide preset's `yearsToFI` derivation.

---

## 7. Risks & honest notes

- **Historical μ is a weak estimator.** Say so in the readout ("derived from N years of
  history; assumptions, not predictions"), and make the fallback constants editable in one
  file so the owner can pin her own capital-market assumptions.
- **Correlation stability** — cov from 5y daily data shifts with the window; badge the window
  length next to σ and let the market panel's range setting (post-FIXES F21) drive it.
- **Yahoo endpoint fragility** — already acknowledged in COSTS.md; fallbacks are the insulation.
- **Advice line** — the moment copy drifts from "this lever does X" to "you should X," stop and
  rewrite. The glide preset is the closest to the line; its copy explains the mechanism
  (sequence risk) and lets the user choose.
