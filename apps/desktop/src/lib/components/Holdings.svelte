<script lang="ts">
  import { onMount } from "svelte";
  import { formatUsd } from "$lib/format";
  import { lots } from "$lib/stores/lots.svelte";
  import FanChart from "./FanChart.svelte";

  const today = () => new Date().toISOString().slice(0, 10);
  let draft = $state({ ticker: "", side: "buy" as "buy" | "sell", shares: 0, price: 0, fee: 0, date: today() });

  onMount(() => {
    void lots.load();
  });

  async function add(e: Event) {
    e.preventDefault();
    if (!draft.ticker.trim() || draft.shares <= 0 || draft.price <= 0) return;
    await lots.add({
      id: crypto.randomUUID(),
      ticker: draft.ticker.trim().toUpperCase(),
      side: draft.side,
      tradeDate: draft.date,
      shares: String(draft.shares),
      price: String(draft.price),
      fee: String(draft.fee || 0),
    });
    draft = { ticker: "", side: "buy", shares: 0, price: 0, fee: 0, date: today() };
  }

  const positions = $derived(lots.positions);
  function priceOf(t: string): number | null {
    return lots.prices[t] ?? null;
  }
</script>

<section class="holdings">
  <header class="title">Positions &amp; lots</header>

  <form class="add" onsubmit={add}>
    <input class="t" placeholder="Ticker" bind:value={draft.ticker} />
    <select bind:value={draft.side}><option value="buy">Buy</option><option value="sell">Sell</option></select>
    <input type="number" min="0" step="any" placeholder="Shares" bind:value={draft.shares} />
    <input type="number" min="0" step="any" placeholder="Price/share" bind:value={draft.price} />
    <input type="number" min="0" step="any" placeholder="Fee" bind:value={draft.fee} />
    <input type="date" bind:value={draft.date} />
    <button type="submit">Add lot</button>
  </form>

  <div class="actions">
    <button class="run" onclick={() => lots.refresh()} disabled={lots.loading || positions.length === 0}>
      {lots.loading ? "Fetching…" : "Refresh prices & trends"}
    </button>
    {#if lots.error}<span class="warn">{lots.error}</span>{/if}
  </div>

  {#if positions.length > 0}
    <h3>Positions</h3>
    <table>
      <thead>
        <tr><th>Ticker</th><th>Open shares</th><th>Cost basis</th><th>Value</th><th>Unrealized</th><th>Realized (LT/ST)</th><th></th></tr>
      </thead>
      <tbody>
        {#each positions as p (p.ticker)}
          {@const price = priceOf(p.ticker)}
          {@const shares = Number(p.openShares.toString())}
          {@const basis = Number(p.costBasis.toString())}
          {@const value = price == null ? null : shares * price}
          <tr>
            <td class="mono tk">{p.ticker}</td>
            <td class="mono">{p.openShares.toString()}</td>
            <td class="mono">{formatUsd(basis)}</td>
            <td class="mono">{value == null ? "—" : formatUsd(value)}</td>
            <td class="mono" class:gain={value != null && value - basis >= 0} class:loss={value != null && value - basis < 0}>
              {value == null ? "—" : formatUsd(value - basis)}
            </td>
            <td class="mono small">{formatUsd(Number(p.realized.longTerm.toString()))} / {formatUsd(Number(p.realized.shortTerm.toString()))}</td>
            <td><button class="link" onclick={() => lots.project(p.ticker)} disabled={lots.estimating || shares <= 0}>Project</button></td>
          </tr>
        {/each}
      </tbody>
    </table>

    <h3>Lots</h3>
    <table>
      <thead><tr><th>Date</th><th>Ticker</th><th>Side</th><th>Shares</th><th>Price</th><th>Fee</th><th></th></tr></thead>
      <tbody>
        {#each lots.rows as l (l.id)}
          <tr>
            <td class="mono">{l.tradeDate}</td>
            <td class="mono tk">{l.ticker}</td>
            <td class:loss={l.side === "sell"}>{l.side}</td>
            <td class="mono">{l.shares}</td>
            <td class="mono">{formatUsd(Number(l.price))}</td>
            <td class="mono">{formatUsd(Number(l.fee))}</td>
            <td><button class="link del" onclick={() => lots.remove(l.id)}>✕</button></td>
          </tr>
        {/each}
      </tbody>
    </table>
  {:else}
    <p class="empty">No lots yet — record a buy (ticker, shares, price/share, date).</p>
  {/if}

  {#if lots.estimate}
    <div class="estimate">
      <p class="cap">
        {lots.estimate.ticker} — {lots.estimate.years}-year projection from its historical trend.
        <span class="disclaimer">An estimate based on past returns, not a prediction or advice.</span>
      </p>
      <FanChart forecast={lots.estimate.forecast} currentAge={0} />
    </div>
  {/if}
</section>

<style>
  .holdings {
    max-width: 64rem;
    margin: 0 auto;
    padding: 2rem 1.5rem 4rem;
  }
  .title {
    font-family: var(--font-display);
    letter-spacing: 0.2em;
    color: var(--color-brass);
    font-size: 1.3rem;
    text-align: center;
    margin-bottom: 1.4rem;
  }
  h3 {
    font-family: var(--font-display);
    color: var(--color-gilt);
    letter-spacing: 0.08em;
    margin: 1.6rem 0 0.4rem;
  }
  .add {
    display: flex;
    gap: 0.5rem;
    flex-wrap: wrap;
    justify-content: center;
    margin-bottom: 1rem;
  }
  input,
  select {
    background: var(--color-coal);
    border: 1px solid var(--color-etch);
    border-radius: 6px;
    color: var(--color-parchment);
    font-family: var(--font-meter);
    padding: 0.45rem 0.6rem;
  }
  .add .t {
    text-transform: uppercase;
    width: 5.5rem;
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
    margin-bottom: 0.5rem;
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
    padding: 0.45rem 0.6rem;
    border-bottom: 1px solid var(--color-etch);
    color: var(--color-parchment);
  }
  td:first-child {
    text-align: left;
  }
  .tk {
    color: var(--color-brass);
  }
  .small {
    font-size: 0.85rem;
    color: var(--color-soot);
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
