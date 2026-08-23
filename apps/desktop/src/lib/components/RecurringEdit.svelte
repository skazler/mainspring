<script lang="ts">
  /**
   * Inline editor for one recurring row. Prices change — insurance gets requoted,
   * rent goes up at renewal — and re-adding the item loses its history and its
   * end date. So the row is edited in place and saved through the same upsert
   * `save` already uses; the id never changes.
   */
  import type { RecurringRow } from "$lib/db";

  interface Props {
    row: RecurringRow;
    /** Category suggestions for this row's kind. */
    categories: readonly string[];
    datalistId: string;
    onsave: (row: RecurringRow) => void;
    oncancel: () => void;
  }
  let { row, categories, datalistId, onsave, oncancel }: Props = $props();

  const CADENCES = ["weekly", "biweekly", "monthly", "quarterly", "annual"] as const;

  // Seed a local draft so Cancel is a real cancel — nothing touches the store
  // until Save. Amount stays a string end-to-end: it goes back into NUMERIC(18,4)
  // and a float round-trip is exactly what the money rules forbid.
  //
  // Capturing `row`'s *initial* value is deliberate: the parent only mounts this
  // component for the row being edited, so a later store update must not stomp
  // what's being typed. That's precisely what the warning below describes.
  // svelte-ignore state_referenced_locally
  let label = $state(row.label);
  // svelte-ignore state_referenced_locally
  let category = $state(row.category);
  // svelte-ignore state_referenced_locally
  let amount = $state(row.amount);
  // svelte-ignore state_referenced_locally
  let cadence = $state<RecurringRow["cadence"]>(row.cadence);

  const valid = $derived(label.trim().length > 0 && Number(amount) > 0 && Number.isFinite(Number(amount)));

  function submit(e: Event) {
    e.preventDefault();
    if (!valid) return;
    onsave({ ...row, label: label.trim(), category: category.trim().toLowerCase(), amount: String(amount), cadence });
  }

  /** Escape anywhere in the row backs out, matching the rest of the app. */
  function onkeydown(e: KeyboardEvent) {
    if (e.key === "Escape") { e.preventDefault(); oncancel(); }
  }
</script>

<td colspan="7">
  <!-- Escape is delegated from the form: every child is a control, so the
       listener is only ever reached from a focused input, select or button. -->
  <!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
  <form class="edit" onsubmit={submit} {onkeydown}>
    <!-- svelte-ignore a11y_autofocus -->
    <input class="lbl" bind:value={label} placeholder="What is it?" autofocus aria-label="Label" />
    <input class="cat" list={datalistId} bind:value={category} placeholder="Category" aria-label="Category" />
    <datalist id={datalistId}>{#each categories as c (c)}<option value={c}></option>{/each}</datalist>
    <input class="amt" type="number" min="0" step="any" bind:value={amount} placeholder="Amount" aria-label="Amount" />
    <select bind:value={cadence} aria-label="Cadence">
      {#each CADENCES as c (c)}<option value={c}>{c}</option>{/each}
    </select>
    <button type="submit" disabled={!valid}>Save</button>
    <button type="button" class="link" onclick={oncancel}>Cancel</button>
  </form>
</td>

<style>
  .edit {
    display: flex;
    flex-wrap: wrap;
    gap: 0.4rem;
    align-items: center;
    padding: 0.15rem 0;
  }
  .edit input,
  .edit select {
    background: var(--color-panel);
    border: 1px solid var(--color-brass);
    color: var(--color-parchment);
    border-radius: 5px;
    padding: 0.28rem 0.45rem;
    font-family: var(--font-body);
    font-size: 0.82rem;
  }
  .edit .lbl { flex: 2 1 11rem; }
  .edit .cat { flex: 1 1 7rem; }
  .edit .amt { flex: 0 1 6rem; font-family: var(--font-meter); font-variant-numeric: tabular-nums; }
  .edit button[type="submit"] {
    background: var(--color-brass);
    color: var(--color-ink, #17130e);
    border: none;
    border-radius: 5px;
    padding: 0.3rem 0.75rem;
    font-family: var(--font-body);
    font-size: 0.82rem;
    cursor: pointer;
  }
  .edit button[type="submit"]:disabled { opacity: 0.45; cursor: not-allowed; }
  .link {
    background: none;
    border: none;
    color: var(--color-soot);
    font-family: var(--font-body);
    font-size: 0.78rem;
    cursor: pointer;
    text-decoration: underline;
  }
</style>
