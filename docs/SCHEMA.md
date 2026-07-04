# MAINSPRING — Backend Schema Reference

Every table, defined once in **`packages/schema/src/tables.ts`** (Drizzle) and shared by the engine, the app, and any future cloud. Drizzle generates SQL migrations (`packages/schema/drizzle/`) that apply **unchanged** to local PGlite *and* a hosted Postgres — that's the whole point of choosing PGlite. See [`DOMAIN_MODEL.md`](./DOMAIN_MODEL.md) for the ER diagram and [`DATA_LAYER.md`](./DATA_LAYER.md) for persistence.

## Conventions

| Convention | Rule |
|---|---|
| **Money** | `money(...)` custom type → Postgres **`NUMERIC(18,4)`**, `Money` (decimal.js) in TS. Never a float. Round-trips as an exact string. |
| **Rates / percentages** | `rate(...)` → **`NUMERIC(6,4)`**, values in `[0,1]` (SWR, dial pct, success probability). Exact string. |
| **IDs** | `uuid` primary keys, `defaultRandom()` (`gen_random_uuid()`), except composite/one-to-one cases noted below. |
| **Timestamps** | `timestamptz` with `defaultNow()`. Dates are `date`. |
| **Deletes** | Child rows `ON DELETE CASCADE` from their parent (`profiles` / `accounts` / `scenarios`). |
| **Enums** | Stored as `text` with the allowed set enforced in Zod (`packages/schema/src/zod.ts`), not PG enums — keeps migrations simple. |

## Tables

### `profiles` — the household
The root entity; one per user (single-tenant, but modelled to scale).

| Column | Type | Null | Notes |
|---|---|---|---|
| `id` | uuid PK | | |
| `display_name` | text | ✗ | |
| `birth_date` | date | ✗ | age is derived from this |
| `target_retire_age` | int | ✗ | |
| `annual_expenses` | money | ✗ | fixed/essential expenses |
| `swr` | rate | ✗ | safe withdrawal rate, e.g. `0.0400` |
| `real_return` | rate | ✓ | assumed real return for projections, e.g. `0.0500` |

### `income_sources` — earnings (→ `profiles`)
| Column | Type | Null | Notes |
|---|---|---|---|
| `id` | uuid PK | | |
| `profile_id` | uuid FK | ✗ | → `profiles.id` |
| `label` | text | ✗ | |
| `gross_amount` | money | ✗ | per-period gross |
| `frequency` | text | ✗ | `weekly \| biweekly \| monthly \| annual` |
| `is_w2` | bool | ✗ | W-2 vs other |

### `tax_profiles` — filing (1:1 with `profiles`)
`profile_id` is the PK (one tax profile per household).

| Column | Type | Null | Notes |
|---|---|---|---|
| `profile_id` | uuid PK/FK | ✗ | → `profiles.id` |
| `filing_status` | text | ✗ | `single \| mfj \| mfs \| hoh` |
| `state` | text | ✗ | e.g. `TX` (⇒ 0 state income tax) |
| `tax_year` | int | ✗ | selects versioned constants |

### `dials` — allocation dials (→ `profiles`)
| Column | Type | Null | Notes |
|---|---|---|---|
| `id` | uuid PK | | |
| `profile_id` | uuid FK | ✗ | → `profiles.id` |
| `bucket` | text | ✗ | `401k_pretax \| roth_401k \| ira \| hsa \| brokerage \| emergency \| sinking \| cash` |
| `pct` | rate | ✗ | fraction of `base`, `0..1` |
| `base` | text | ✗ | `gross \| net \| post_tax_savings` |
| `priority` | int | ✗ | fill order for capped buckets |
| `annual_cap` | money | ✓ | IRS limit, if capped |

### `accounts` — where money lives (→ `profiles`)
| Column | Type | Null | Notes |
|---|---|---|---|
| `id` | uuid PK | | |
| `profile_id` | uuid FK | ✗ | → `profiles.id` |
| `kind` | text | ✗ | `401k \| roth_ira \| trad_ira \| hsa \| brokerage \| savings \| checking` |
| `tax_advantaged` | bool | ✗ | |
| `balance` | money | ✗ | current balance |

### `holdings` — current positions (→ `accounts`)
Snapshot of a position; cost basis is authoritatively *derived* from `lots`.

| Column | Type | Null | Notes |
|---|---|---|---|
| `id` | uuid PK | | |
| `account_id` | uuid FK | ✗ | → `accounts.id` |
| `ticker` | text | ✗ | |
| `shares` | numeric(18,6) | ✗ | fractional shares |
| `cost_basis` | money | ✗ | |

### `lots` — buy/sell event log (→ `accounts`)
The source of truth for positions; holdings + realized gains derive from these (`STOCK_MANAGEMENT.md`).

| Column | Type | Null | Notes |
|---|---|---|---|
| `id` | uuid PK | | |
| `account_id` | uuid FK | ✗ | → `accounts.id` |
| `ticker` | text | ✗ | |
| `side` | text | ✗ | `buy \| sell` |
| `trade_date` | date | ✗ | |
| `shares` | numeric(18,6) | ✗ | |
| `price` | money | ✗ | per-share execution price |
| `fee` | money | ✗ | default `0` |
| `closes_lot_id` | uuid | ✓ | sell → the buy-lot it disposes (specific-ID); null for FIFO/buys |

### `contributions` — money flowing in (→ `accounts`)
| Column | Type | Null | Notes |
|---|---|---|---|
| `id` | uuid PK | | |
| `account_id` | uuid FK | ✗ | → `accounts.id` |
| `period` | date | ✗ | |
| `amount` | money | ✗ | |
| `source_dial` | text | ✓ | which dial produced it |

### `scenarios` — saved plans (→ `profiles`)
| Column | Type | Null | Notes |
|---|---|---|---|
| `id` | uuid PK | | |
| `profile_id` | uuid FK | ✗ | → `profiles.id` |
| `name` | text | ✗ | |
| `dial_state` | jsonb | ✗ | full versioned snapshot |
| `assumptions` | jsonb | ✗ | returns, vol, inflation |
| `schema_version` | int | ✗ | default `1`; upgrades old blobs on read |

### `forecasts` — Monte Carlo results (→ `scenarios`)
| Column | Type | Null | Notes |
|---|---|---|---|
| `id` | uuid PK | | |
| `scenario_id` | uuid FK | ✗ | → `scenarios.id` |
| `computed_at` | timestamptz | ✗ | default now |
| `fi_number` | money | ✗ | |
| `months_to_fi` | int | ✗ | |
| `percentile_bands` | jsonb | ✗ | p10/p25/p50/p75/p90 paths |
| `success_probability` | rate | ✗ | |
| `inputs_hash` | text | ✗ | cache key — skip re-running unchanged scenarios |

### `market_bars` — price history (composite PK `ticker`,`d`)
| Column | Type | Null | Notes |
|---|---|---|---|
| `ticker` | text | ✗ | PK part |
| `d` | date | ✗ | PK part |
| `close` | money | ✗ | |
| `total_return` | numeric(18,8) | ✓ | total-return series when available |

### `spending` — variable/discretionary spending (→ `profiles`)
Feeds total expenses → savings pool, FI number, and net worth.

| Column | Type | Null | Notes |
|---|---|---|---|
| `id` | uuid PK | | |
| `profile_id` | uuid FK | ✗ | → `profiles.id` |
| `category` | text | ✗ | e.g. `coffee`, `clothes` |
| `label` | text | ✓ | free-text note |
| `amount` | money | ✗ | |
| `spent_at` | date | ✗ | |

### `net_worth_snapshots` — historical net worth (→ `profiles`)
Point-in-time captures → the dashboard's net-worth line.

| Column | Type | Null | Notes |
|---|---|---|---|
| `id` | uuid PK | | |
| `profile_id` | uuid FK | ✗ | → `profiles.id` |
| `captured_at` | timestamptz | ✗ | default now |
| `total` | money | ✗ | |
| `breakdown` | jsonb | ✓ | per-account/section split |

## Migrations

Generated SQL lives in `packages/schema/drizzle/` (`0000_…` → `0002_…`), with a `meta/` journal. Regenerate after editing `tables.ts`:

```bash
pnpm --filter @mainspring/schema db:generate
```

Apply to a hosted Postgres unchanged with `drizzle-kit migrate` (pointed at the connection string). Locally, the PGlite integration test (`packages/schema/tests/roundtrip.test.ts`) applies them and verifies exact-decimal round-trips.

## App-local note (transitional)

Today the desktop app persists via a **simplified subset** of local PGlite tables hand-created in `apps/desktop/src/lib/db.ts` (`app_state` jsonb for the setup form, plus `market_bars`, `scenarios`, `lots`, `spending`, `net_worth_snapshots`), which **diverge from the canonical schema above** (e.g. app `lots` omit `account_id`; app `scenarios` store the whole form blob). The planned cutover — apply these Drizzle migrations in-app and use `drizzle-orm/pglite` everywhere — lands with the setup wizard so the normalized rows (`accounts`, `holdings`, …) get collected properly. Until then, treat this file as the **target** schema and `db.ts` as the current local shape.
