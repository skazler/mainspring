# MAINSPRING — Domain Model

The entities, their relationships, and the money-handling rules. Schema is defined once with Drizzle (tables) + Zod (validation) in `packages/schema` and consumed by both the engine and the UI.

---

## 1. Entity relationships

```mermaid
erDiagram
    PROFILE ||--o{ INCOME_SOURCE : has
    PROFILE ||--|| TAX_PROFILE : has
    PROFILE ||--o{ DIAL : has
    PROFILE ||--o{ ACCOUNT : owns
    ACCOUNT ||--o{ HOLDING : contains
    ACCOUNT ||--o{ CONTRIBUTION : receives
    PROFILE ||--o{ SCENARIO : saves
    SCENARIO ||--o{ FORECAST : produces
    HOLDING }o--|| MARKET_BAR : "priced by"

    PROFILE {
        uuid id PK
        text display_name
        date birth_date
        int target_retire_age
        numeric annual_expenses
        numeric swr "safe withdrawal rate, e.g. 0.04"
    }
    INCOME_SOURCE {
        uuid id PK
        text label
        numeric gross_amount
        text frequency "weekly|biweekly|monthly|annual"
        bool is_w2
    }
    TAX_PROFILE {
        text filing_status "single|mfj|mfs|hoh"
        text state "TX => 0 state income tax"
        int tax_year "selects versioned constants"
    }
    DIAL {
        uuid id PK
        text bucket "401k_pretax|roth_401k|ira|hsa|brokerage|emergency|sinking|cash"
        numeric pct "0..1 of base"
        text base "gross|net|post_tax_savings"
        int priority "fill order for capped buckets"
        numeric annual_cap "IRS limit if applicable"
    }
    ACCOUNT {
        uuid id PK
        text kind "401k|roth_ira|trad_ira|hsa|brokerage|savings|checking"
        bool tax_advantaged
        numeric balance
    }
    HOLDING {
        text ticker
        numeric shares
        numeric cost_basis
    }
    CONTRIBUTION {
        date period
        numeric amount
        text source_dial
    }
    SCENARIO {
        uuid id PK
        text name
        jsonb dial_state "full snapshot, versioned"
        jsonb assumptions "returns, vol, inflation"
    }
    FORECAST {
        timestamptz computed_at
        numeric fi_number
        int months_to_fi
        jsonb percentile_bands "p10/p25/p50/p75/p90 paths"
        numeric success_probability
        text inputs_hash "cache key"
    }
    MARKET_BAR {
        text ticker
        date d
        numeric close
        numeric total_return
    }
```

---

## 2. Money handling (non-negotiable)

- **DB columns:** Postgres `NUMERIC(18,4)` (PGlite is Postgres, so this holds locally too).
- **In TS:** a `Money` value object backed by `dinero.js` (integer minor units) — never the JS `number` type for currency. A lint rule + a branded type forbid constructing `Money` from a float.
- **Percentages (dial positions):** fixed-precision decimals in `[0, 1]`.
- **Rounding:** explicit `HALF_UP`, applied only at display/persist boundaries — never mid-calculation.
- **Serialization:** money crosses the TS↔Rust boundary (to the sim kernel) as integer minor units or scaled fixed-point, not floats, to keep the kernel deterministic.

## 3. Schema source of truth

```
packages/schema/
  tables.ts        # Drizzle table defs  → migrations (PGlite + Postgres)
  zod.ts           # Zod schemas         → engine I/O + API/IPC validation
  index.ts         # inferred TS types re-exported to engine + UI
```

One definition produces: the migration, the runtime validator, and the static types. Agents import from `@mainspring/schema` everywhere; there is no second place a field can drift.

## 4. Scenario versioning

`SCENARIO.dial_state` and `assumptions` are stored as JSONB with an explicit `schema_version`. When the dial schema evolves, a small migrator upgrades old blobs on read, so a plan you saved years ago still loads. `FORECAST.inputs_hash` keys cached Monte Carlo results so an unchanged scenario never re-runs 10k paths.
