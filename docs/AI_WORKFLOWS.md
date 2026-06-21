# MAINSPRING — AI Workflows & Architecture Fit

Two questions, answered honestly: does this stack fit modern agentic *development*, and does it fit modern AI *application* architecture?

---

## 1. Building it with agents

This stack is unusually agent-friendly, mostly because of choices made for other reasons.

**What helps agents here:**
- **One language end to end.** An agent reasons about the whole app in TypeScript — UI, money engine, IPC contracts — without context-switching to a second runtime. The one exception (the Rust kernel) has a tiny, stable surface (`params → percentiles`).
- **Typed contracts as guardrails.** Zod schemas + Drizzle types + Rust struct types mean an agent's change either type-checks against the real contract or fails loudly. There's no untyped seam to drift through.
- **A pure engine with golden tests.** The money math is pure functions with to-the-cent golden tests (see [`TESTING.md`](./TESTING.md)). That's the ideal agent safety net: an agent can refactor freely and the goldens catch any behavioral change instantly.
- **Bounded contexts = bounded tasks.** Each package/crate maps to one [`BUILD_PLAN.md`](./BUILD_PLAN.md) milestone with explicit acceptance criteria. Hand an agent one milestone; it has everything it needs and a clear "done."
- **Local, headless-runnable.** PGlite + the local kernel mean an agent can spin up the entire app in CI with no external services to mock — fast, deterministic feedback loops.

**Honest caveat:** the newest pieces (Svelte 5 runes, Tauri 2, Zero/Electric, PGlite) have *less* training data than React/Express/Postgres, so an agent leans harder on docs and may hallucinate older-API patterns. Mitigations, all cheap:
- Keep these focused `/docs` files in-repo; point the agent at the relevant one per task.
- Add an `AGENTS.md` / `CLAUDE.md` at the root pinning versions and the few non-obvious conventions (runes, `invoke` wrappers, Decimal-only money).
- Pin exact dependency versions and check in a known-good example per pattern (one gauge, one `invoke` command, one golden test) as a template to copy.

Net: the architecture is a good fit for agentic development *specifically because* it's typed, pure where it matters, locally runnable, and decomposed — not because the tools are trendy.

---

## 2. Optional in-app AI

The core app needs **no** AI. Everything below is an opt-in layer; keep it strictly separable.

If you do want it, the forward-facing — and privacy-respecting — patterns are:

**a) Natural-language → dial state ("copilot").**
"What if I push 401k to 15% and open an HSA?" → a model emits a **structured dial-state delta** (JSON validated by the same Zod schema), which the app applies and recomputes through the normal engine. This is the modern tool-use / structured-output pattern: the model proposes; your typed engine is the authority. The model never computes your taxes — it just sets dials.

**b) Explain-the-forecast.** Turn a Monte Carlo result (success probability, sequence risk, the gap to your FI number) into plain language. Low-stakes, no raw account data required — feed it the *derived metrics*, not your ledger.

**c) Expense categorization / forecasting.** The optional ML piece in [`PREDICTION_ENGINE.md`](./PREDICTION_ENGINE.md) §3.

**Privacy is the design constraint.** This holds your real finances, so:
- Prefer **local inference** — a small model via Ollama, or ONNX in-process — so nothing leaves the machine. PGlite's `pgvector` can hold local embeddings for retrieval over your own notes/history.
- If you call a hosted API for heavier reasoning, send **abstracted/derived numbers** (ratios, the metrics), never raw account balances or identifiers, and make it an explicit, off-by-default toggle.

**MCP angle (fits how you already work).** Expose MAINSPRING's scenario operations — `set_dials`, `run_forecast`, `compare_scenarios` — as an **MCP server**. Then an external agent (e.g. your existing assistant) can drive the planner conversationally while the app stays the source of truth and the math stays local. The app is the tool; the agent is the operator. This is the cleanest forward-facing integration: agent-controllable without surrendering the model or the data.

---

## 3. Architecture-fit summary

| Modern AI-era trait | How MAINSPRING fits |
|---|---|
| Typed, tool-callable contracts | Zod/Drizzle schemas double as the agent's tool/IO contracts |
| Structured output over free-form | NL→dial-state delta, validated, applied by the engine |
| Local / private inference | Ollama/ONNX in-process; `pgvector` in PGlite for local retrieval |
| Agent-controllable surface | optional MCP server exposing scenario tools |
| Deterministic authority kept out of the model | the pure TS engine computes; the model only proposes inputs |

The throughline: **AI proposes, the typed local engine decides.** That keeps the forward-facing AI ergonomics without putting your money math — or your data — at the mercy of a model.
