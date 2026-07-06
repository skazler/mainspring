<script lang="ts">
  import { exportAll, importAll, type BackupData } from "$lib/db";

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
</script>

<div class="backup">
  <h3>Your data</h3>
  <p class="note">Everything you've entered lives only on this device. Save a backup file to keep it safe or move it to another machine.</p>
  <div class="backup-row">
    <button type="button" class="ghost" onclick={exportData}>⤓ Download backup</button>
    <button type="button" class="ghost" onclick={() => fileInput?.click()}>⤒ Restore from file…</button>
    <input bind:this={fileInput} type="file" accept="application/json,.json" onchange={onImportFile} hidden />
  </div>
  {#if backupMsg}<p class="backup-msg">{backupMsg}</p>{/if}
  <p class="note dim">⚠ The backup file is your full financial ledger, <strong>unencrypted</strong> — store it somewhere you'd keep a bank statement. Restore merges records by id; your API key isn't included (re-enter it after restoring).</p>
</div>

<style>
  .backup {
    max-width: 40rem;
    margin: 0 auto;
  }
  h3 {
    font-family: var(--font-display);
    color: var(--color-gilt);
    letter-spacing: 0.1em;
    font-size: 0.95rem;
    margin: 0 0 0.4rem;
  }
  .note {
    color: var(--color-soot);
    font-family: var(--font-body);
    font-size: 0.9rem;
    margin: 0 0 0.5rem;
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
  .note.dim strong {
    color: var(--color-oxblood);
  }
</style>
