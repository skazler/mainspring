# MAINSPRING — Money Engine

The pure, isomorphic TypeScript core. No I/O, no framework, no storage. Given inputs, it returns numbers. It runs in the webview for instant dial feedback and is identical anywhere else. This is the durable asset of the whole project — treat it accordingly.

Location: `packages/engine/`.

---

## 1. Shape

```
packages/engine/src/
  cashflow/        annualize income; per-period gross
  tax/
    constants/
      2025.ts      brackets, FICA rates + wage base, std deduction, contribution limits
      2026.ts      ← update yearly; selected by taxProfile.taxYear
    brackets.ts    progressive bracket application (pure)
    fica.ts        Social Security (wage-base capped) + Medicare (+ addl over threshold)
    state.ts       state table; TX => 0
    engine.ts      compose: taxableIncome, federal, fica, state, effective + marginal
  allocation/      dials → bucket dollars, caps + priority + clamps
  fire/            fi number, time-to-FI, coast/barista, savings rate
  recompute.ts     the single entry point the UI calls on every dial change
  index.ts
```

Everything is a pure function: `recompute(state) -> view`. No `fetch`, no DB, no `Date.now()` inside the math (clock is passed in). This is what makes it instant, testable to the cent, and portable.

---

## 2. The entry point

```ts
// packages/engine/src/recompute.ts
import type { ProfileState, AllocationView } from "@mainspring/schema";

export function recompute(state: ProfileState): AllocationView {
  const gross = annualizeIncome(state.incomeSources);
  const pretax = sumPretaxDials(state.dials);          // 401k_pretax, hsa, trad_ira
  const tax = computeTax(gross, state.taxProfile, pretax);
  const net = gross.subtract(tax.total);
  const buckets = allocate(gross, net, state.dials);   // respects caps + priority
  const fire = fireMetrics(state, buckets, net);
  return { gross, tax, net, buckets, fire };
}
```

The UI calls `recompute` synchronously on every dial drag. No network. No IPC. Same frame.

---

## 3. Tax engine (most correctness-sensitive)

Keep it boring and pinned.

- **Versioned constants.** `taxProfile.taxYear` selects `constants/<year>.ts`. Brackets, FICA wage base, standard deduction, and contribution limits change annually and must be **verified against IRS publications** before a projection is trusted. This is a calculation model, not tax advice.
- **Texas advantage baked in.** `state.ts` returns 0 for TX (no state income tax), which materially changes take-home versus a CA/NY plan. The engine still supports other states so the model survives a move.
- **Pre-tax vs Roth.** Pre-tax buckets (`401k_pretax`, `hsa`, `trad_ira`) reduce taxable income *before* the bracket pass; Roth buckets do not. The allocation step feeds pre-tax totals back into the tax step so the taxable base is right.
- **Outputs:** `taxableIncome`, `federal`, `fica`, `state`, `total`, plus `effectiveRate` and `marginalRate` (marginal drives "what does the next dollar into 401k actually save me").

### Golden tests
`packages/engine/tests/tax/golden/` holds hand-verified scenarios (single TX W2 at several incomes, with and without pre-tax contributions) with federal/FICA/net expected **to the cent**. Any constant change requires a deliberate golden update — this is the firewall against silently wrong take-home.

---

## 4. Allocation engine

Turns dial percentages into dollars, honoring annual caps and fill priority.

- Each dial has a `base` (`gross` / `net` / `post_tax_savings`), a `pct`, an optional `annual_cap` (IRS limit), and a `priority`.
- Capped buckets (401k, IRA, HSA) clamp at their limit; overflow routes to the next-priority bucket; the UI is told a clamp occurred (so a gauge can show it).
- **Invariant:** within a shared base, dial percentages cannot sum past 100%. Enforced in the engine and surfaced to the store so the UI can prevent it.
- **Invariant:** `Σ allocated + leftover_cash == net` (or the relevant base) exactly. Property-tested (see [`TESTING.md`](./TESTING.md)).

---

## 5. FIRE metrics

Derived from the deterministic projection (full math in [`PREDICTION_ENGINE.md`](./PREDICTION_ENGINE.md)):

- **FI number** = `annualExpenses / swr` (4% → ×25).
- **Time to FI** = first year balance ≥ FI number.
- **Coast FIRE number** = `fiNumber / (1 + rReal)^(yearsToTargetRetire)` — the amount that coasts to FI with zero further contributions.
- **Barista FIRE** = FI threshold under partial-income assumptions.
- **Savings rate** = total annual contributions / net — the single biggest lever on time-to-FI. Surface it prominently.

---

## 6. Why isomorphic matters here

Because this engine is plain TypeScript with no dependencies on the UI, the DB, or the network:

- the dial loop is instant (it runs in-process in the webview),
- there is exactly one implementation of every tax/allocation rule,
- it tests in milliseconds with no harness,
- and it survives every other technology choice in the repo. If Svelte, Tauri, PGlite, and the Rust kernel were all replaced tomorrow, this package would be untouched.
