import { sql } from "drizzle-orm";
import {
  boolean,
  customType,
  date,
  integer,
  jsonb,
  numeric,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";
import { Money } from "./money";

/**
 * `money` column — Postgres NUMERIC(18,4) on the wire, {@link Money} in TS.
 * Drizzle returns numeric as a string, which is exactly what `Money.of` consumes,
 * so decimals round-trip without ever touching a JS float.
 */
export const money = customType<{ data: Money; driverData: string }>({
  dataType() {
    return "numeric(18, 4)";
  },
  toDriver(value: Money): string {
    return value.toString();
  },
  fromDriver(value: string): Money {
    return Money.of(value);
  },
});

/** A rate / percentage in [0,1] (e.g. SWR, dial pct, success prob). Kept as an exact string. */
const rate = (name: string) => numeric(name, { precision: 6, scale: 4 });

export const profiles = pgTable("profiles", {
  id: uuid("id").primaryKey().defaultRandom(),
  displayName: text("display_name").notNull(),
  birthDate: date("birth_date").notNull(),
  targetRetireAge: integer("target_retire_age").notNull(),
  annualExpenses: money("annual_expenses").notNull(),
  swr: rate("swr").notNull(),
  /** Assumed real (inflation-adjusted) return for projections, e.g. 0.05. */
  realReturn: rate("real_return"),
});

export const incomeSources = pgTable("income_sources", {
  id: uuid("id").primaryKey().defaultRandom(),
  profileId: uuid("profile_id")
    .notNull()
    .references(() => profiles.id, { onDelete: "cascade" }),
  label: text("label").notNull(),
  grossAmount: money("gross_amount").notNull(),
  frequency: text("frequency").notNull(), // weekly|biweekly|monthly|annual
  isW2: boolean("is_w2").notNull(),
});

export const taxProfiles = pgTable("tax_profiles", {
  // one-to-one with profile: profile_id is the PK
  profileId: uuid("profile_id")
    .primaryKey()
    .references(() => profiles.id, { onDelete: "cascade" }),
  filingStatus: text("filing_status").notNull(), // single|mfj|mfs|hoh
  state: text("state").notNull(), // TX => 0 state income tax
  taxYear: integer("tax_year").notNull(),
});

export const dials = pgTable("dials", {
  id: uuid("id").primaryKey().defaultRandom(),
  profileId: uuid("profile_id")
    .notNull()
    .references(() => profiles.id, { onDelete: "cascade" }),
  bucket: text("bucket").notNull(), // 401k_pretax|roth_401k|ira|roth_ira|hsa|brokerage|emergency|sinking|cash
  pct: rate("pct").notNull(), // 0..1 of base
  base: text("base").notNull(), // gross|net|post_tax_savings
  priority: integer("priority").notNull(), // fill order for capped buckets
  annualCap: money("annual_cap"), // IRS limit, if applicable
});

export const accounts = pgTable("accounts", {
  id: uuid("id").primaryKey().defaultRandom(),
  profileId: uuid("profile_id")
    .notNull()
    .references(() => profiles.id, { onDelete: "cascade" }),
  kind: text("kind").notNull(), // 401k|roth_ira|trad_ira|hsa|brokerage|savings|checking
  taxAdvantaged: boolean("tax_advantaged").notNull(),
  balance: money("balance").notNull(),
});

export const holdings = pgTable("holdings", {
  id: uuid("id").primaryKey().defaultRandom(),
  accountId: uuid("account_id")
    .notNull()
    .references(() => accounts.id, { onDelete: "cascade" }),
  ticker: text("ticker").notNull(),
  shares: numeric("shares", { precision: 18, scale: 6 }).notNull(),
  costBasis: money("cost_basis").notNull(),
});

// Buy/sell event log. A holding + its cost basis are *derived* from open lots.
// See docs/STOCK_MANAGEMENT.md.
export const lots = pgTable("lots", {
  id: uuid("id").primaryKey().defaultRandom(),
  accountId: uuid("account_id")
    .notNull()
    .references(() => accounts.id, { onDelete: "cascade" }),
  ticker: text("ticker").notNull(),
  side: text("side").notNull(), // buy|sell
  tradeDate: date("trade_date").notNull(),
  shares: numeric("shares", { precision: 18, scale: 6 }).notNull(),
  price: money("price").notNull(), // per-share execution price
  fee: money("fee").notNull().default(sql`0`),
  // a sell references the buy-lot it disposes (specific-ID); null for FIFO / buys
  closesLotId: uuid("closes_lot_id"),
});

export const contributions = pgTable("contributions", {
  id: uuid("id").primaryKey().defaultRandom(),
  accountId: uuid("account_id")
    .notNull()
    .references(() => accounts.id, { onDelete: "cascade" }),
  period: date("period").notNull(),
  amount: money("amount").notNull(),
  sourceDial: text("source_dial"),
});

export const scenarios = pgTable("scenarios", {
  id: uuid("id").primaryKey().defaultRandom(),
  profileId: uuid("profile_id")
    .notNull()
    .references(() => profiles.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  dialState: jsonb("dial_state").notNull(), // full snapshot, versioned
  assumptions: jsonb("assumptions").notNull(), // returns, vol, inflation
  schemaVersion: integer("schema_version").notNull().default(1),
});

export const forecasts = pgTable("forecasts", {
  id: uuid("id").primaryKey().defaultRandom(),
  scenarioId: uuid("scenario_id")
    .notNull()
    .references(() => scenarios.id, { onDelete: "cascade" }),
  computedAt: timestamp("computed_at", { withTimezone: true }).notNull().defaultNow(),
  fiNumber: money("fi_number").notNull(),
  monthsToFi: integer("months_to_fi").notNull(),
  percentileBands: jsonb("percentile_bands").notNull(), // p10/p25/p50/p75/p90 paths
  successProbability: rate("success_probability").notNull(),
  inputsHash: text("inputs_hash").notNull(), // cache key
});

export const marketBars = pgTable(
  "market_bars",
  {
    ticker: text("ticker").notNull(),
    d: date("d").notNull(),
    close: money("close").notNull(),
    totalReturn: numeric("total_return", { precision: 18, scale: 8 }),
  },
  (t) => [primaryKey({ columns: [t.ticker, t.d] })],
);

// Variable / discretionary spending (coffee, clothes, dining…). Feeds total
// expenses, so it flows into the savings pool, FI number, and net worth.
export const spending = pgTable("spending", {
  id: uuid("id").primaryKey().defaultRandom(),
  profileId: uuid("profile_id")
    .notNull()
    .references(() => profiles.id, { onDelete: "cascade" }),
  category: text("category").notNull(),
  label: text("label"),
  amount: money("amount").notNull(),
  spentAt: date("spent_at").notNull(),
});

// Point-in-time net-worth captures → the historical net-worth line.
export const netWorthSnapshots = pgTable("net_worth_snapshots", {
  id: uuid("id").primaryKey().defaultRandom(),
  profileId: uuid("profile_id")
    .notNull()
    .references(() => profiles.id, { onDelete: "cascade" }),
  capturedAt: timestamp("captured_at", { withTimezone: true }).notNull().defaultNow(),
  total: money("total").notNull(),
  /** Per-account/section breakdown. */
  breakdown: jsonb("breakdown"),
});

// Savings goals / sinking funds (house down payment, laptop, buffer…).
// `saved_amount` is an asset (→ net worth); `contribution` (per `cadence`) claims
// part of the savings pool. Progress + ETA are derived by the engine.
export const goals = pgTable("goals", {
  id: uuid("id").primaryKey().defaultRandom(),
  profileId: uuid("profile_id")
    .notNull()
    .references(() => profiles.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  targetAmount: money("target_amount").notNull(),
  savedAmount: money("saved_amount").notNull().default(sql`0`),
  // How many months you want to reach it in — a span the user edits, not a
  // deadline that re-prices itself daily. Replaces `target_date`, which a
  // pre-existing local DB still carries (unread) so it keeps opening.
  targetMonths: integer("target_months"),
  contribution: money("monthly_contribution"), // amount set aside per `cadence`
  contributionCadence: text("contribution_cadence").notNull().default("monthly"),
  sortOrder: integer("sort_order").notNull().default(0), // display sequence
  active: boolean("active").notNull().default(true), // claims the savings pool while true
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

// Recurring items charged on a cadence. `kind` splits them: "bill" is a fixed
// outflow (insurance, car, API costs…) annualized into total expenses;
// "investment" is an auto-invest (e.g. $50/wk into Acorns) annualized into
// total contributions.
export const recurring = pgTable("recurring", {
  id: uuid("id").primaryKey().defaultRandom(),
  profileId: uuid("profile_id")
    .notNull()
    .references(() => profiles.id, { onDelete: "cascade" }),
  label: text("label").notNull(),
  category: text("category").notNull(),
  amount: money("amount").notNull(), // per-occurrence, not annualized
  cadence: text("cadence").notNull().default("monthly"), // weekly | biweekly | monthly | quarterly | annual
  kind: text("kind").notNull().default("bill"), // bill (expense) | investment (contribution)
  active: boolean("active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

// Maps a held ticker to a Calibre asset class (the Registers group positions by
// class; unknown tickers get a one-time class picker). Single-user local, so no
// profile scope — the mapping is a shared classification, not personal data.
export const tickerClasses = pgTable("ticker_classes", {
  ticker: text("ticker").primaryKey(),
  classId: text("class_id").notNull(), // AssetClassId: us_total | us_large | intl_dev | emerging | bonds | reits | cash
});

export const schema = {
  profiles,
  incomeSources,
  taxProfiles,
  dials,
  accounts,
  holdings,
  lots,
  contributions,
  scenarios,
  forecasts,
  marketBars,
  spending,
  netWorthSnapshots,
  goals,
  recurring,
  tickerClasses,
};
