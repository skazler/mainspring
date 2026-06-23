<script lang="ts">
  import { onMount } from "svelte";
  import { formatUsd } from "$lib/format";
  import { holdingGain, holdingValue, type Holding } from "$lib/holdings";
  import { holdings } from "$lib/stores/holdings.svelte";
  import FanChart from "./FanChart.svelte";

  let draft = $state<Holding>({ ticker: "", shares: 0, costBasis: 0, acquiredOn: new Date().toISOString().slice(0, 10) });

  onMount(() => {
    void holdings.load();
  });

  async function add(e: Event) {
    e.preventDefault();
    if (!draft.ticker.trim() || draft.shares <= 0) return;
    await holdings.add({ ...draft, ticker: draft.ticker.trim().toUpperCase() });
    draft = { ticker: "", shares: 0, costBasis: 0, acquiredOn: new Date().toISOString().slice(0, 10) };
  }

  function priceOf(t: string): number | null {
    return holdings.prices[t] ?? null;
  }
</script>

<section class="holdings">
  <header class="title">Holdings</header>

  <form class="add" onsubmit={add}>
    <input class="t" placeholder="Ticker" bind:value={draft.ticker} />
    <input type="number" min="0" step="any" placeholder="Shares" bind:value={draft.shares} />
    <input type="number" min="0" step="any" placeholder="Cost basis $" bind:value={draft.costBasis} />
    <input type="date" bind:value={draft.acquiredOn} />
    <button type="submit">Add</button>
  </form>

  <div class="actions">
    <button class="run" onclick={() => holdings.refresh()} disabled={holdings.loading || holdings.items.length === 0}>
      {holdings.loading ? "Fetching…" : "Refresh prices & trends"}
    </button>
    {#if holdings.error}<span class="warn">{holdings.error}</span>{/if}
  </div>

  {#if holdings.items.length === 0}
    <p class="empty">No holdings yet — add a ticker, shares, and what you paid.</p>
  {:else}
    <table>
      <thead>
        <tr><th>Ticker</th><th>Shares</th><th>Cost basis</th><th>Value</th><th>Gain</th><th></th><th></th></tr>
      </thead>
      <tbody>
        {#each holdings.items as h, i (h.ticker + h.acquiredOn + i)}
          {@const price = priceOf(h.ticker)}
          <tr>
            <td class="mono">{h.ticker}</td>
            <td class="mono">{h.shares}</td>
            <td class="mono">{formatUsd(h.costBasis)}</td>
            <td class="mono">{price == null ? "—" : formatUsd(holdingValue(h, price))}</td>
            <td class="mono" class:gain={price != null && holdingGain(h, price) >= 0} class:loss={price != null && holdingGain(h, price) < 0}>
              {price == null ? "—" : formatUsd(holdingGain(h, price))}
            </td>
            <td>
              <button class="link" onclick={() => holdings.project(h)} disabled={holdings.estimating}>Project</button>
            </td>
            <td>
              <button class="link del" onclick={() => holdings.remove(i)}>✕</button>
            </td>
          </tr>
        {/each}
      </tbody>
    </table>
  {/if}

  {#if holdings.estimate}
    <div class="estimate">
      <p class="cap">
        {holdings.estimate.ticker} — {holdings.estimate.years}-year projection from its historical trend.
        <span class="disclaimer">An estimate based on past returns, not a prediction or advice.</span>
      </p>
      <FanChart forecast={holdings.estimate.forecast} currentAge={0} />
    </div>
  {/if}
</section>

<style>
  .holdings {
    max-width: 60rem;
    margin: 0 auto;
    padding: 2rem 1.5rem 4rem;
  }
  .title {
    font-family: var(--font-display);
    letter-spacing: 0.2em;
    color: var(--color-brass);
    font-size: 1.3rem;
    text-align: center;
    margin-bottom: 1.6rem;
  }
  .add {
    display: flex;
    gap: 0.6rem;
    flex-wrap: wrap;
    justify-content: center;
    margin-bottom: 1rem;
  }
  input {
    background: var(--color-coal);
    border: 1px solid var(--color-etch);
    border-radius: 6px;
    color: var(--color-parchment);
    font-family: var(--font-meter);
    padding: 0.45rem 0.6rem;
  }
  .add .t {
    text-transform: uppercase;
    width: 6rem;
  }
  button {
    cursor: pointer;
    border-radius: 6px;
    font-family: var(--font-body);
  }
  .add button,
  .run {
    background: var(--color-brass);
    color: var(--color-coal);
    border: none;
    padding: 0.5rem 1.1rem;
  }
  .actions {
    text-align: center;
    margin-bottom: 1.5rem;
  }
  .run:disabled {
    opacity: 0.6;
    cursor: default;
  }
  table {
    width: 100%;
    border-collapse: collapse;
    font-family: var(--font-meter);
  }
  th {
    text-align: right;
    color: var(--color-soot);
    font-family: var(--font-body);
    font-weight: 400;
    font-size: 0.8rem;
    padding: 0.4rem 0.6rem;
    border-bottom: 1px solid var(--color-etch);
  }
  th:first-child {
    text-align: left;
  }
  td {
    text-align: right;
    padding: 0.5rem 0.6rem;
    border-bottom: 1px solid var(--color-etch);
    color: var(--color-parchment);
  }
  td.mono:first-child {
    text-align: left;
    color: var(--color-brass);
  }
  td.gain {
    color: var(--color-lime-rust);
  }
  td.loss {
    color: var(--color-oxblood);
  }
  .link {
    background: transparent;
    border: 1px solid var(--color-etch);
    color: var(--color-soot);
    padding: 0.25rem 0.6rem;
    font-size: 0.8rem;
  }
  .link:hover {
    color: var(--color-gilt);
    border-color: var(--color-gilt);
  }
  .del {
    color: var(--color-oxblood);
  }
  .empty {
    text-align: center;
    color: var(--color-dim);
    font-family: var(--font-body);
  }
  .estimate {
    margin-top: 2.5rem;
  }
  .cap {
    text-align: center;
    color: var(--color-parchment);
    font-family: var(--font-body);
  }
  .disclaimer {
    display: block;
    color: var(--color-dim);
    font-size: 0.78rem;
    margin-top: 0.25rem;
  }
  .warn {
    color: var(--color-oxblood);
    margin-left: 0.75rem;
  }
</style>
