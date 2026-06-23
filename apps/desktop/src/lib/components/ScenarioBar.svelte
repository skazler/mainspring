<script lang="ts">
  import { onMount } from "svelte";
  import { formatPct, formatUsd } from "$lib/format";
  import { scenarioSummary } from "$lib/scenario";
  import { scenarios } from "$lib/stores/scenarios.svelte";
  import { setupForm } from "$lib/stores/setup-form.svelte";

  let name = $state("");

  onMount(() => {
    void scenarios.load();
  });

  async function save() {
    await scenarios.saveCurrent(name);
    name = "";
  }

  // Columns: the live plan plus each selected scenario.
  const columns = $derived([
    { id: "current", label: "Current", summary: scenarioSummary(setupForm) },
    ...scenarios.items
      .filter((s) => scenarios.selected.includes(s.id))
      .map((s) => ({ id: s.id, label: s.name, summary: scenarioSummary(s.form) })),
  ]);
</script>

<section class="bar">
  <div class="save">
    <input placeholder="Name this plan…" bind:value={name} />
    <button onclick={save}>Save scenario</button>
  </div>

  {#if scenarios.items.length > 0}
    <ul class="list">
      {#each scenarios.items as s (s.id)}
        <li>
          <label class="pick">
            <input type="checkbox" checked={scenarios.selected.includes(s.id)} onchange={() => scenarios.toggleSelect(s.id)} />
            {s.name}
          </label>
          <button class="link" onclick={() => scenarios.apply(s)}>Load</button>
          <button class="link del" onclick={() => scenarios.remove(s.id)}>✕</button>
        </li>
      {/each}
    </ul>
  {/if}

  {#if columns.length > 1}
    <table class="compare">
      <thead>
        <tr><th></th>{#each columns as c (c.id)}<th>{c.label}</th>{/each}</tr>
      </thead>
      <tbody>
        <tr><td>Take-home</td>{#each columns as c (c.id)}<td>{formatUsd(c.summary.takeHome)}</td>{/each}</tr>
        <tr><td>Savings rate</td>{#each columns as c (c.id)}<td>{formatPct(c.summary.savingsRate)}</td>{/each}</tr>
        <tr><td>FI age</td>{#each columns as c (c.id)}<td>{c.summary.fiAge ?? "—"}</td>{/each}</tr>
        <tr><td>FI number</td>{#each columns as c (c.id)}<td>{formatUsd(c.summary.fiNumber)}</td>{/each}</tr>
      </tbody>
    </table>
  {/if}
</section>

<style>
  .bar {
    border: 1px solid var(--color-etch);
    border-radius: 10px;
    background: var(--color-panel);
    padding: 1rem 1.25rem;
    margin-bottom: 2rem;
  }
  .save {
    display: flex;
    gap: 0.6rem;
    justify-content: center;
  }
  input {
    background: var(--color-coal);
    border: 1px solid var(--color-etch);
    border-radius: 6px;
    color: var(--color-parchment);
    font-family: var(--font-body);
    padding: 0.45rem 0.6rem;
  }
  .save button {
    background: var(--color-brass);
    color: var(--color-coal);
    border: none;
    border-radius: 6px;
    padding: 0.45rem 1rem;
    cursor: pointer;
    font-family: var(--font-body);
  }
  .list {
    list-style: none;
    padding: 0;
    margin: 1rem 0 0;
    display: flex;
    flex-wrap: wrap;
    gap: 0.75rem;
    justify-content: center;
  }
  .list li {
    display: flex;
    align-items: center;
    gap: 0.4rem;
    border: 1px solid var(--color-etch);
    border-radius: 6px;
    padding: 0.3rem 0.6rem;
  }
  .pick {
    display: flex;
    align-items: center;
    gap: 0.4rem;
    color: var(--color-parchment);
    font-family: var(--font-body);
  }
  .link {
    background: transparent;
    border: none;
    color: var(--color-soot);
    cursor: pointer;
    font-size: 0.85rem;
  }
  .link:hover {
    color: var(--color-gilt);
  }
  .del {
    color: var(--color-oxblood);
  }
  .compare {
    width: 100%;
    border-collapse: collapse;
    margin-top: 1.25rem;
    font-family: var(--font-meter);
    font-variant-numeric: tabular-nums;
  }
  .compare th,
  .compare td {
    text-align: right;
    padding: 0.4rem 0.7rem;
    border-bottom: 1px solid var(--color-etch);
    color: var(--color-parchment);
  }
  .compare th {
    color: var(--color-gilt);
    font-family: var(--font-display);
    letter-spacing: 0.06em;
  }
  .compare td:first-child,
  .compare th:first-child {
    text-align: left;
    color: var(--color-soot);
    font-family: var(--font-body);
  }
</style>
