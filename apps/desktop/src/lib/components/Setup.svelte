<script lang="ts">
  import { bucketLabel } from "$lib/buckets";
  import { formatMoney } from "$lib/format";
  import { saveSetupForm, exportAll, importAll, type BackupData } from "$lib/db";
  import { buildProfileState } from "$lib/setup-map";
  import { applySetup } from "$lib/stores/profile.svelte";
  import { session } from "$lib/stores/session.svelte";
  import { markSetupSaved, setupBaseline, setupForm } from "$lib/stores/setup-form.svelte";
  import { Money } from "@mainspring/schema";

  const form = setupForm;
  let error = $state<string | null>(null);

  // Changed from the last saved state? Drives the disabled/confirm behavior.
  const dirty = $derived(JSON.stringify(form) !== setupBaseline.json);

  const FREQUENCIES = [
    { v: "annual", l: "Annual" },
    { v: "monthly", l: "Monthly" },
    { v: "biweekly", l: "Bi-weekly" },
    { v: "weekly", l: "Weekly" },
  ] as const;
  const FILING = [
    { v: "single", l: "Single" },
    { v: "mfj", l: "Married filing jointly" },
    { v: "mfs", l: "Married filing separately" },
    { v: "hoh", l: "Head of household" },
  ] as const;
  // Only no-income-tax states are modeled so far (see engine/tax/state.ts).
  const STATES = ["TX", "FL", "WA", "NV", "TN", "NH", "SD", "WY", "AK"];

  function start(e: Event) {
    e.preventDefault();
    error = null;
    try {
      applySetup(buildProfileState(form));
    } catch (err) {
      error = err instanceof Error ? err.message : String(err);
      return;
    }
    // Advance immediately — don't block the UI on persistence (it can hang/fail
    // in a packaged build). Save in the background and surface any error.
    session.configured = true;
    session.hasProfile = true;
    markSetupSaved();
    saveSetupForm(form).catch((err) => {
      error = `Saved in memory, but couldn't persist: ${err instanceof Error ? err.message : String(err)}`;
    });
  }

  // Backup / restore.
  let backupMsg = $state<string | null>(null);
  let fileInput = $state<HTMLInputElement>();

  async function exportData() {
    backupMsg = null;
    try {
      const data = await exportAll();
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `mainspring-backup-${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      backupMsg = "Backup file downloaded.";
    } catch (e) {
      backupMsg = `Export failed: ${e instanceof Error ? e.message : String(e)}`;
    }
  }

  async function onImportFile(e: Event) {
    const input = e.currentTarget as HTMLInputElement;
    const file = input.files?.[0];
    input.value = ""; // allow re-picking the same file
    if (!file) return;
    backupMsg = "Restoring…";
    try {
      const data = JSON.parse(await file.text()) as BackupData;
      await importAll(data);
      backupMsg = "Restored. Reloading…";
      setTimeout(() => location.reload(), 500);
    } catch (err) {
      backupMsg = `Import failed: ${err instanceof Error ? err.message : String(err)}`;
    }
  }

  // Inline confirm (native confirm() is unreliable in the Tauri webview).
  let confirmBack = $state(false);
  function back() {
    if (dirty && !confirmBack) {
      confirmBack = true;
      return;
    }
    // discard unsaved edits by reverting to the saved baseline
    Object.assign(form, JSON.parse(setupBaseline.json));
    error = null;
    confirmBack = false;
    session.configured = true;
  }
</script>

<form class="setup" onsubmit={start}>
  <header>
    {#if session.hasProfile}
      {#if confirmBack}
        <span class="back-confirm">
          <button type="button" class="back discard" onclick={back}>Discard changes?</button>
          <button type="button" class="cancelback" onclick={() => (confirmBack = false)}>✕</button>
        </span>
      {:else}
        <button type="button" class="back" onclick={back}>← Back</button>
      {/if}
    {/if}
    <h1>MAINSPRING</h1>
    <p class="sub">Set the scene — your income, taxes, and what you're saving into.</p>
    {#if error}<p class="err">{error}</p>{/if}
  </header>

  <fieldset>
    <legend>Income</legend>
    <label>Gross income<input type="number" min="0" step="1000" bind:value={form.grossAmount} /></label>
    <label>Frequency
      <select bind:value={form.frequency}>
        {#each FREQUENCIES as f (f.v)}<option value={f.v}>{f.l}</option>{/each}
      </select>
    </label>
  </fieldset>

  <fieldset>
    <legend>Taxes</legend>
    <label>Filing status
      <select bind:value={form.filingStatus}>
        {#each FILING as f (f.v)}<option value={f.v}>{f.l}</option>{/each}
      </select>
    </label>
    <label>State
      <select bind:value={form.state}>
        {#each STATES as s (s)}<option value={s}>{s}</option>{/each}
      </select>
    </label>
    <p class="note">No-income-tax states only for now (TX baked in).</p>
  </fieldset>

  <fieldset>
    <legend>You</legend>
    <label>Current age<input type="number" min="0" max="100" bind:value={form.currentAge} /></label>
    <label>Target retire age<input type="number" min="0" max="100" bind:value={form.targetRetireAge} /></label>
    <label>Invested assets today<input type="number" min="0" step="1000" bind:value={form.currentBalance} /></label>
    <label>Withdrawal rate %<input type="number" min="1" max="10" step="0.1" bind:value={form.swrPercent} /></label>
    <label>Assumed real return %<input type="number" min="0" max="15" step="0.1" bind:value={form.realReturnPercent} /></label>
    <label title="Deflates nominal market returns into real ones for the forecast.">Assumed inflation %<input type="number" min="0" max="15" step="0.1" bind:value={form.inflationPct} /></label>
  </fieldset>

  <fieldset class="contributions">
    <legend>Contributions</legend>
    {#each form.contributions as c (c.bucket)}
      <div class="contrib" class:on={c.enabled}>
        <label class="toggle"><input type="checkbox" bind:checked={c.enabled} />{bucketLabel(c.bucket)}</label>
        <div class="amt-cell">
          {#if c.base === "gross"}
            <button
              type="button"
              class="unit"
              disabled={!c.enabled}
              title="Switch between % of gross and a fixed dollar amount"
              onclick={() => (c.mode = c.mode === "amount" ? "percent" : "amount")}
            >{c.mode === "amount" ? "$" : "%"}</button>
          {/if}
          <label class="pct">
            {#if c.mode === "amount"}
              <input type="number" min="0" step="any" bind:value={c.amount} disabled={!c.enabled} /> $/yr
            {:else}
              <input type="number" min="0" max="100" step="any" bind:value={c.percent} disabled={!c.enabled} /> %
            {/if}
          </label>
        </div>
        <span class="cap">{c.cap ? `cap ${formatMoney(Money.of(c.cap))}` : ""}</span>
      </div>
    {/each}
    <div class="contrib match on">
      <span class="toggle" title="The percent of your salary your employer adds to your 401(k). Free money — it grows your net worth but isn't taken from your paycheck.">Employer 401(k) match</span>
      <label class="pct">
        <input type="number" min="0" max="25" step="0.1" bind:value={form.employerMatchPercent} /> %
      </label>
      <span class="cap">of gross</span>
    </div>
  </fieldset>

  <fieldset class="backup">
    <legend>Backup &amp; restore</legend>
    <p class="note">Everything you've entered lives only on this device. Save a backup file to keep it safe or move it to another machine.</p>
    <div class="backup-row">
      <button type="button" class="ghost" onclick={exportData}>Download backup</button>
      <button type="button" class="ghost" onclick={() => fileInput?.click()}>Restore from file…</button>
      <input bind:this={fileInput} type="file" accept="application/json,.json" onchange={onImportFile} hidden />
    </div>
    {#if backupMsg}<p class="backup-msg">{backupMsg}</p>{/if}
    <p class="note dim">Restore merges records by id; your API key isn't included (re-enter it after restoring).</p>
  </fieldset>

  <button type="submit" disabled={session.hasProfile && !dirty}>
    {session.hasProfile ? "Save changes →" : "Wind it up →"}
  </button>
</form>

<style>
  .setup {
    max-width: 40rem;
    margin: 0 auto;
    padding: 2.5rem 1.5rem 4rem;
    display: flex;
    flex-direction: column;
    gap: 1.5rem;
  }
  header {
    text-align: center;
    position: relative;
  }
  .back {
    position: absolute;
    left: 0;
    top: 0;
    background: transparent;
    border: 1px solid var(--color-etch);
    border-radius: 6px;
    color: var(--color-soot);
    font-family: var(--font-body);
    padding: 0.4rem 0.8rem;
    cursor: pointer;
  }
  .back:hover {
    color: var(--color-gilt);
    border-color: var(--color-gilt);
  }
  .back-confirm {
    position: absolute;
    left: 0;
    top: 0;
    display: inline-flex;
    gap: 0.3rem;
    align-items: center;
  }
  .back-confirm .back {
    position: static;
  }
  .discard {
    color: var(--color-oxblood);
    border-color: var(--color-oxblood);
  }
  .cancelback {
    background: transparent;
    border: 1px solid var(--color-etch);
    border-radius: 6px;
    color: var(--color-soot);
    font-family: var(--font-body);
    padding: 0.4rem 0.6rem;
    cursor: pointer;
  }
  .cancelback:hover {
    color: var(--color-parchment);
  }
  .backup-row {
    display: flex;
    gap: 0.6rem;
    flex-wrap: wrap;
    margin: 0.4rem 0;
  }
  .ghost {
    background: transparent;
    border: 1px solid var(--color-brass);
    border-radius: 6px;
    color: var(--color-brass);
    font-family: var(--font-body);
    padding: 0.5rem 1rem;
    cursor: pointer;
  }
  .ghost:hover {
    background: var(--color-brass);
    color: var(--color-coal);
  }
  .backup-msg {
    font-family: var(--font-body);
    color: var(--color-gilt);
    font-size: 0.85rem;
    margin: 0.3rem 0;
  }
  .note.dim {
    color: var(--color-dim);
    font-size: 0.75rem;
  }
  .err {
    color: var(--color-oxblood);
    font-family: var(--font-body);
  }
  h1 {
    font-family: var(--font-display);
    letter-spacing: 0.35em;
    color: var(--color-brass);
    margin: 0;
  }
  .sub {
    color: var(--color-soot);
    font-family: var(--font-body);
  }
  fieldset {
    border: 1px solid var(--color-etch);
    border-radius: 10px;
    background: var(--color-panel);
    padding: 1rem 1.25rem 1.25rem;
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 0.9rem 1.25rem;
  }
  legend {
    font-family: var(--font-display);
    color: var(--color-gilt);
    letter-spacing: 0.12em;
    padding: 0 0.5rem;
  }
  label {
    display: flex;
    flex-direction: column;
    gap: 0.3rem;
    font-family: var(--font-body);
    color: var(--color-soot);
    font-size: 0.85rem;
  }
  input,
  select {
    background: var(--color-coal);
    border: 1px solid var(--color-etch);
    border-radius: 6px;
    color: var(--color-parchment);
    font-family: var(--font-meter);
    font-variant-numeric: tabular-nums;
    padding: 0.5rem 0.6rem;
  }
  input:focus,
  select:focus {
    outline: none;
    border-color: var(--color-gilt);
  }
  .note {
    grid-column: 1 / -1;
    margin: 0;
    color: var(--color-dim);
    font-size: 0.75rem;
  }
  .contributions {
    grid-template-columns: 1fr;
  }
  .contrib {
    display: grid;
    grid-template-columns: 1fr auto 7rem;
    align-items: center;
    gap: 0.75rem;
    opacity: 0.55;
    transition: opacity 120ms;
  }
  .amt-cell {
    display: flex;
    align-items: center;
    gap: 0.4rem;
    justify-content: flex-end;
  }
  .unit {
    background: transparent;
    border: 1px solid var(--color-etch);
    border-radius: 6px;
    color: var(--color-soot);
    font-family: var(--font-meter);
    width: 1.7rem;
    height: 1.7rem;
    cursor: pointer;
    flex-shrink: 0;
  }
  .unit:hover:not(:disabled) {
    color: var(--color-gilt);
    border-color: var(--color-gilt);
  }
  .unit:disabled {
    opacity: 0.4;
    cursor: default;
  }
  .contrib.on {
    opacity: 1;
  }
  .toggle {
    flex-direction: row;
    align-items: center;
    gap: 0.5rem;
    color: var(--color-parchment);
    font-family: var(--font-body);
    font-size: 0.95rem;
  }
  .pct {
    flex-direction: row;
    align-items: center;
    gap: 0.4rem;
    color: var(--color-soot);
  }
  .pct input {
    width: 4.5rem;
  }
  .cap {
    font-family: var(--font-meter);
    color: var(--color-dim);
    font-size: 0.8rem;
  }
  button[type="submit"] {
    align-self: center;
    background: var(--color-brass);
    color: var(--color-coal);
    border: none;
    border-radius: 8px;
    font-family: var(--font-display);
    letter-spacing: 0.1em;
    font-size: 1rem;
    padding: 0.7rem 2rem;
    cursor: pointer;
  }
  button[type="submit"]:hover:not(:disabled) {
    background: var(--color-gilt);
  }
  button[type="submit"]:disabled {
    opacity: 0.45;
    cursor: default;
  }
</style>
