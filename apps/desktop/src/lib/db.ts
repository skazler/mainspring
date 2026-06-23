import { browser } from "$app/environment";
import type { Bar } from "$lib/bridge/invoke";
import type { Holding } from "$lib/holdings";
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

export async function saveHoldings(holdings: Holding[]): Promise<void> {
  if (!browser) return;
  const d = await db();
  await d.query(
    `INSERT INTO app_state (key, value) VALUES ('holdings', $1::jsonb)
     ON CONFLICT (key) DO UPDATE SET value = $1::jsonb;`,
    [JSON.stringify(holdings)],
  );
}

export async function loadHoldings(): Promise<Holding[]> {
  if (!browser) return [];
  const d = await db();
  const res = await d.query<{ value: Holding[] }>("SELECT value FROM app_state WHERE key = 'holdings';");
  return res.rows[0]?.value ?? [];
}
