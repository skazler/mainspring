import { browser } from "$app/environment";
import type { Bar } from "$lib/bridge/invoke";
import type { Scenario } from "$lib/scenario";
import type { SetupForm } from "$lib/setup-map";

/**
 * Local persistence via PGlite (Postgres in the webview), backed by IndexedDB so
 * setup survives a reload. Lazy + dynamically imported so it never runs during
 * SSR/prerender. v1 stores the setup form as JSON in a small app_state table;
 * normalized writes to the profile/dials tables come with the data layer.
 */
let dbPromise: Promise<import("@electric-sql/pglite").PGlite> | null = null;

async function open() {
  const { PGlite } = await import("@electric-sql/pglite");
  const db = await PGlite.create("idb://mainspring");
  await db.exec(`
    CREATE TABLE IF NOT EXISTS app_state (key text PRIMARY KEY, value jsonb NOT NULL);
    CREATE TABLE IF NOT EXISTS market_bars (
      ticker text NOT NULL,
      d date NOT NULL,
      close double precision NOT NULL,
      PRIMARY KEY (ticker, d)
    );
    CREATE TABLE IF NOT EXISTS scenarios (
      id text PRIMARY KEY,
      name text NOT NULL,
      form jsonb NOT NULL,
      created_at timestamptz NOT NULL DEFAULT now()
    );
    CREATE TABLE IF NOT EXISTS lots (
      id text PRIMARY KEY,
      ticker text NOT NULL,
      side text NOT NULL,
      trade_date date NOT NULL,
      shares numeric(18, 6) NOT NULL,
      price numeric(18, 4) NOT NULL,
      fee numeric(18, 4) NOT NULL DEFAULT 0
    );
    CREATE TABLE IF NOT EXISTS spending (
      id text PRIMARY KEY,
      category text NOT NULL,
      label text,
      amount numeric(18, 4) NOT NULL,
      spent_at date NOT NULL
    );
    CREATE TABLE IF NOT EXISTS net_worth_snapshots (
      id text PRIMARY KEY,
      captured_at timestamptz NOT NULL DEFAULT now(),
      total numeric(18, 4) NOT NULL,
      breakdown jsonb
    );
    CREATE TABLE IF NOT EXISTS goals (
      id text PRIMARY KEY,
      name text NOT NULL,
      target_amount numeric(18, 4) NOT NULL,
      saved_amount numeric(18, 4) NOT NULL DEFAULT 0,
      target_date date,
      monthly_contribution numeric(18, 4),
      contribution_cadence text NOT NULL DEFAULT 'monthly',
      sort_order integer NOT NULL DEFAULT 0,
      created_at timestamptz NOT NULL DEFAULT now()
    );
    ALTER TABLE goals ADD COLUMN IF NOT EXISTS sort_order integer NOT NULL DEFAULT 0;
    ALTER TABLE goals ADD COLUMN IF NOT EXISTS contribution_cadence text NOT NULL DEFAULT 'monthly';
    CREATE TABLE IF NOT EXISTS recurring (
      id text PRIMARY KEY,
      label text NOT NULL,
      category text NOT NULL,
      amount numeric(18, 4) NOT NULL,
      cadence text NOT NULL DEFAULT 'monthly',
      kind text NOT NULL DEFAULT 'bill',
      active boolean NOT NULL DEFAULT true,
      created_at timestamptz NOT NULL DEFAULT now()
    );
    ALTER TABLE recurring ADD COLUMN IF NOT EXISTS kind text NOT NULL DEFAULT 'bill';
  `);
  return db;
}

function db() {
  if (!dbPromise) dbPromise = open();
  return dbPromise;
}

export async function saveSetupForm(form: SetupForm): Promise<void> {
  if (!browser) return;
  const d = await db();
  await d.query(
    `INSERT INTO app_state (key, value) VALUES ('setup', $1::jsonb)
     ON CONFLICT (key) DO UPDATE SET value = $1::jsonb;`,
    [JSON.stringify(form)],
  );
}

export async function loadSetupForm(): Promise<SetupForm | null> {
  if (!browser) return null;
  const d = await db();
  const res = await d.query<{ value: SetupForm }>("SELECT value FROM app_state WHERE key = 'setup';");
  return res.rows[0]?.value ?? null;
}

/** Replace a ticker's stored history with a freshly-fetched series. */
export async function saveBars(ticker: string, bars: Bar[]): Promise<void> {
  if (!browser || bars.length === 0) return;
  const d = await db();
  await d.transaction(async (tx) => {
    await tx.query("DELETE FROM market_bars WHERE ticker = $1;", [ticker]);
    const values: string[] = [];
    const params: unknown[] = [];
    bars.forEach((b, i) => {
      const o = i * 3;
      values.push(`($${o + 1}, $${o + 2}, $${o + 3})`);
      params.push(ticker, b.date, b.close);
    });
    await tx.query(
      `INSERT INTO market_bars (ticker, d, close) VALUES ${values.join(",")};`,
      params,
    );
  });
}

/** Local close series for a ticker, oldest first. The simulator reads this, never live. */
export async function loadCloses(ticker: string): Promise<number[]> {
  if (!browser) return [];
  const d = await db();
  const res = await d.query<{ close: number }>(
    "SELECT close FROM market_bars WHERE ticker = $1 ORDER BY d;",
    [ticker],
  );
  return res.rows.map((r) => r.close);
}

/** Most recent cached close for a ticker, or null if none stored. */
export async function latestClose(ticker: string): Promise<number | null> {
  if (!browser) return null;
  const d = await db();
  const res = await d.query<{ close: number }>(
    "SELECT close FROM market_bars WHERE ticker = $1 ORDER BY d DESC LIMIT 1;",
    [ticker],
  );
  return res.rows[0]?.close ?? null;
}

/** A buy/sell lot as stored in the normalized `lots` table (money as exact strings). */
export interface LotRow {
  id: string;
  ticker: string;
  side: "buy" | "sell";
  tradeDate: string;
  shares: string;
  price: string;
  fee: string;
}

export async function loadLots(): Promise<LotRow[]> {
  if (!browser) return [];
  const d = await db();
  const res = await d.query<{ id: string; ticker: string; side: "buy" | "sell"; trade_date: string; shares: string; price: string; fee: string }>(
    "SELECT id, ticker, side, trade_date::text AS trade_date, shares, price, fee FROM lots ORDER BY trade_date, id;",
  );
  return res.rows.map((r) => ({
    id: r.id,
    ticker: r.ticker,
    side: r.side,
    tradeDate: r.trade_date,
    shares: r.shares,
    price: r.price,
    fee: r.fee,
  }));
}

export async function saveLot(lot: LotRow): Promise<void> {
  if (!browser) return;
  const d = await db();
  await d.query(
    `INSERT INTO lots (id, ticker, side, trade_date, shares, price, fee)
     VALUES ($1, $2, $3, $4, $5::numeric, $6::numeric, $7::numeric)
     ON CONFLICT (id) DO UPDATE SET
       ticker = $2, side = $3, trade_date = $4, shares = $5::numeric, price = $6::numeric, fee = $7::numeric;`,
    [lot.id, lot.ticker, lot.side, lot.tradeDate, lot.shares, lot.price, lot.fee],
  );
}

export async function deleteLot(id: string): Promise<void> {
  if (!browser) return;
  const d = await db();
  await d.query("DELETE FROM lots WHERE id = $1;", [id]);
}

/** A variable-spending entry (amount as an exact string). */
export interface SpendingRow {
  id: string;
  category: string;
  label: string | null;
  amount: string;
  spentAt: string;
}

export async function loadSpending(): Promise<SpendingRow[]> {
  if (!browser) return [];
  const d = await db();
  // date columns come back as JS Date objects unless cast to text.
  const res = await d.query<{ id: string; category: string; label: string | null; amount: string; spent_at: string }>(
    "SELECT id, category, label, amount, spent_at::text AS spent_at FROM spending ORDER BY spent_at DESC, id;",
  );
  return res.rows.map((r) => ({ id: r.id, category: r.category, label: r.label, amount: r.amount, spentAt: r.spent_at }));
}

export async function saveSpending(row: SpendingRow): Promise<void> {
  if (!browser) return;
  const d = await db();
  await d.query(
    `INSERT INTO spending (id, category, label, amount, spent_at)
     VALUES ($1, $2, $3, $4::numeric, $5)
     ON CONFLICT (id) DO UPDATE SET category = $2, label = $3, amount = $4::numeric, spent_at = $5;`,
    [row.id, row.category, row.label, row.amount, row.spentAt],
  );
}

export async function deleteSpending(id: string): Promise<void> {
  if (!browser) return;
  const d = await db();
  await d.query("DELETE FROM spending WHERE id = $1;", [id]);
}

/**
 * A savings goal (money as exact strings). `contribution` is the amount set aside
 * per `cadence`; `sortOrder` sequences the checklist. (The physical column is still
 * `monthly_contribution` for back-compat, but the value is per-cadence now.)
 */
export interface GoalRow {
  id: string;
  name: string;
  targetAmount: string;
  savedAmount: string;
  targetDate: string | null;
  contribution: string | null;
  cadence: "weekly" | "biweekly" | "monthly" | "quarterly" | "annual";
  sortOrder: number;
}

export async function loadGoals(): Promise<GoalRow[]> {
  if (!browser) return [];
  const d = await db();
  const res = await d.query<{
    id: string;
    name: string;
    target_amount: string;
    saved_amount: string;
    target_date: string | null;
    monthly_contribution: string | null;
    contribution_cadence: GoalRow["cadence"];
    sort_order: number;
  }>(
    "SELECT id, name, target_amount, saved_amount, target_date::text AS target_date, monthly_contribution, contribution_cadence, sort_order, created_at FROM goals ORDER BY sort_order, created_at;",
  );
  return res.rows.map((r) => ({
    id: r.id,
    name: r.name,
    targetAmount: r.target_amount,
    savedAmount: r.saved_amount,
    targetDate: r.target_date,
    contribution: r.monthly_contribution,
    cadence: r.contribution_cadence,
    sortOrder: r.sort_order,
  }));
}

export async function saveGoal(g: GoalRow): Promise<void> {
  if (!browser) return;
  const d = await db();
  await d.query(
    `INSERT INTO goals (id, name, target_amount, saved_amount, target_date, monthly_contribution, contribution_cadence, sort_order)
     VALUES ($1, $2, $3::numeric, $4::numeric, $5, $6, $7, $8)
     ON CONFLICT (id) DO UPDATE SET
       name = $2, target_amount = $3::numeric, saved_amount = $4::numeric, target_date = $5, monthly_contribution = $6, contribution_cadence = $7, sort_order = $8;`,
    [g.id, g.name, g.targetAmount, g.savedAmount, g.targetDate, g.contribution, g.cadence, g.sortOrder],
  );
}

export async function deleteGoal(id: string): Promise<void> {
  if (!browser) return;
  const d = await db();
  await d.query("DELETE FROM goals WHERE id = $1;", [id]);
}

/** A recurring item — a bill (insurance, car, API cost) or an auto-invest (Acorns). */
export interface RecurringRow {
  id: string;
  label: string;
  category: string;
  amount: string;
  cadence: "weekly" | "biweekly" | "monthly" | "quarterly" | "annual";
  kind: "bill" | "investment";
  active: boolean;
}

export async function loadRecurring(): Promise<RecurringRow[]> {
  if (!browser) return [];
  const d = await db();
  const res = await d.query<{ id: string; label: string; category: string; amount: string; cadence: RecurringRow["cadence"]; kind: RecurringRow["kind"]; active: boolean }>(
    "SELECT id, label, category, amount, cadence, kind, active FROM recurring ORDER BY created_at;",
  );
  return res.rows.map((r) => ({ id: r.id, label: r.label, category: r.category, amount: r.amount, cadence: r.cadence, kind: r.kind, active: r.active }));
}

export async function saveRecurring(row: RecurringRow): Promise<void> {
  if (!browser) return;
  const d = await db();
  await d.query(
    `INSERT INTO recurring (id, label, category, amount, cadence, kind, active)
     VALUES ($1, $2, $3, $4::numeric, $5, $6, $7)
     ON CONFLICT (id) DO UPDATE SET
       label = $2, category = $3, amount = $4::numeric, cadence = $5, kind = $6, active = $7;`,
    [row.id, row.label, row.category, row.amount, row.cadence, row.kind, row.active],
  );
}

export async function deleteRecurring(id: string): Promise<void> {
  if (!browser) return;
  const d = await db();
  await d.query("DELETE FROM recurring WHERE id = $1;", [id]);
}

/** Append a net-worth snapshot (history for the dashboard's net-worth line). */
export async function recordNetWorth(total: string, breakdown?: unknown): Promise<void> {
  if (!browser) return;
  const d = await db();
  await d.query(
    "INSERT INTO net_worth_snapshots (id, total, breakdown) VALUES ($1, $2::numeric, $3::jsonb);",
    [crypto.randomUUID(), total, breakdown ? JSON.stringify(breakdown) : null],
  );
}

export async function saveScenario(s: Scenario): Promise<void> {
  if (!browser) return;
  const d = await db();
  await d.query(
    `INSERT INTO scenarios (id, name, form) VALUES ($1, $2, $3::jsonb)
     ON CONFLICT (id) DO UPDATE SET name = $2, form = $3::jsonb;`,
    [s.id, s.name, JSON.stringify(s.form)],
  );
}

export async function listScenarios(): Promise<Scenario[]> {
  if (!browser) return [];
  const d = await db();
  const res = await d.query<{ id: string; name: string; form: Scenario["form"]; created_at: string }>(
    "SELECT id, name, form, created_at FROM scenarios ORDER BY created_at;",
  );
  return res.rows.map((r) => ({ id: r.id, name: r.name, form: r.form, createdAt: r.created_at }));
}

export async function deleteScenario(id: string): Promise<void> {
  if (!browser) return;
  const d = await db();
  await d.query("DELETE FROM scenarios WHERE id = $1;", [id]);
}

export async function saveApiKey(key: string): Promise<void> {
  if (!browser) return;
  const d = await db();
  await d.query(
    `INSERT INTO app_state (key, value) VALUES ('anthropic_key', $1::jsonb)
     ON CONFLICT (key) DO UPDATE SET value = $1::jsonb;`,
    [JSON.stringify(key)],
  );
}

export async function loadApiKey(): Promise<string> {
  if (!browser) return "";
  const d = await db();
  const res = await d.query<{ value: string }>("SELECT value FROM app_state WHERE key = 'anthropic_key';");
  return res.rows[0]?.value ?? "";
}

// ── Backup / restore ──────────────────────────────────────────────
// A portable snapshot of everything you've entered. The API key is left out on
// purpose (it's a re-enterable secret we don't want sitting in a plaintext file);
// market data is a re-fetchable cache, so it's skipped too.

export interface BackupData {
  app: "mainspring";
  version: number;
  exportedAt: string;
  setup: SetupForm | null;
  spending: SpendingRow[];
  recurring: RecurringRow[];
  goals: GoalRow[];
  lots: LotRow[];
  scenarios: Scenario[];
}

/** Gather all user-entered data into a single portable object. */
export async function exportAll(): Promise<BackupData> {
  const [setup, spending, recurring, goals, lots, scenarios] = await Promise.all([
    loadSetupForm(),
    loadSpending(),
    loadRecurring(),
    loadGoals(),
    loadLots(),
    listScenarios(),
  ]);
  return {
    app: "mainspring",
    version: 1,
    exportedAt: new Date().toISOString(),
    setup,
    spending,
    recurring,
    goals,
    lots,
    scenarios,
  };
}

/** Restore a backup, upserting every record by id (non-destructive merge). */
export async function importAll(data: BackupData): Promise<void> {
  if (!browser) return;
  if (data?.app !== "mainspring" || !Array.isArray(data.spending)) {
    throw new Error("That doesn't look like a MAINSPRING backup file.");
  }
  if (data.setup) await saveSetupForm(data.setup);
  for (const r of data.spending) await saveSpending(r);
  for (const r of data.recurring ?? []) await saveRecurring(r);
  for (const g of data.goals ?? []) await saveGoal(g);
  for (const l of data.lots ?? []) await saveLot(l);
  for (const s of data.scenarios ?? []) await saveScenario(s);
}
