import { browser } from "$app/environment";
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
  await db.exec("CREATE TABLE IF NOT EXISTS app_state (key text PRIMARY KEY, value jsonb NOT NULL);");
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
