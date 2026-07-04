<script lang="ts">
  import { onMount } from "svelte";
  import { cadenceAbbrev, formatUsd } from "$lib/format";
  import { lots } from "$lib/stores/lots.svelte";
  import { recurring } from "$lib/stores/recurring.svelte";
  import FanChart from "./FanChart.svelte";
  import ConfirmButton from "./ConfirmButton.svelte";

  const CADENCES = ["weekly", "biweekly", "monthly", "quarterly", "annual"] as const;
  const INVEST_CATEGORIES = ["acorns", "robo-advisor", "brokerage", "401k", "ira", "crypto", "other"];
  const today = () => new Date().toISOString().slice(0, 10);
  let draft = $state({ ticker: "", side: "buy" as "buy" | "sell", shares: 0, price: 0, fee: 0, date: today() });
  let auto = $state<{ label: string; category: string; amount: number; cadence: (typeof CADENCES)[number] }>({
    label: "",
    category: "acorns",
    amount: 0,
    cadence: "weekly",
  });

  onMount(() => {
    void lots.load();
    void recurring.load();
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

  function addAuto(e: Event) {
    e.preventDefault();
    if (!auto.label.trim() || auto.amount <= 0) return;
    recurring.save({
      id: crypto.randomUUID(),
      label: auto.label.trim(),
      category: auto.category.trim().toLowerCase(),
      amount: String(auto.amount),
      cadence: auto.cadence,
      kind: "investment",
      active: true,
    });
    auto = { label: "", category: auto.category, amount: 0, cadence: auto.cadence };
  }

  const positions = $derived(lots.positions);
  function priceOf(t: string): number | null {
    return lots.prices[t] ?? null;
  }
</script>

<section class="holdings">
  <header class="title">Investments</header>
  <p class="lede">Two ways to track what you invest: <strong>automatic contributions</strong> (recurring transfers like Acorns — they feed your net-worth projection) and <strong>tracked positions</strong> (individual buys/sells of a ticker, so you can project that holding's trend).</p>

  <div class="block">
    <h2 class="section">Recurring contributions</h2>
    <p class="hint">Auto-invest transfers — e.g. $50/week into Acorns. Counted as savings, so they lift your total contributions and freedom date.</p>

    <form class="add" onsubmit={addAuto}>
      <input class="lbl" placeholder="What is it? (e.g. Acorns)" bind:value={auto.label} />
      <input class="cat" list="invest-cats" placeholder="Where" bind:value={auto.category} />
      <datalist id="invest-cats">{#each INVEST_CATEGORIES as c (c)}<option value={c}></option>{/each}</datalist>
      <input type="number" min="0" step="any" placeholder="Amount" bind:value={auto.amount} />
      <select bind:value={auto.cadence}>
        {#each CADENCES as c (c)}<option value={c}>{c}</option>{/each}
      </select>
      <button type="submit">Add</button>
    </form>

    <div class="summary">
      <span>Auto-investing: <strong>{formatUsd(Number(recurring.investmentsAnnual.toString()))}</strong>/yr</span>
    </div>

    {#if recurring.error}<span class="warn">{recurring.error}</span>{/if}

    {#if recurring.investments.length > 0}
      <table class="autos">
        <tbody>
          {#each recurring.investments as r (r.id)}
            <tr class:paused={!r.active}>
              <td class="cap">{r.label}<span class="small"> · {r.category}</span></td>
              <td class="mono">{formatUsd(Number(r.amount))}<span class="small">/{cadenceAbbrev(r.cadence)}</span></td>
              <td class="mono">{formatUsd(Number(recurring.annual(r).toString()))}<span class="small">/yr</span></td>
              <td><button class="link" onclick={() => recurring.toggle(r.id)}>{r.active ? "pause" : "resume"}</button></td>
              <td><ConfirmButton onconfirm={() => recurring.remove(r.id)} title="Delete contribution" /></td>
            </tr>
          {/each}
        </tbody>
      </table>
    {:else}
      <p class="empty">No auto-invests yet — add one above (e.g. Acorns, $50, weekly).</p>
    {/if}
  </div>

  <h2 class="section">Tracked positions &amp; lots</h2>
  <p class="hint">Record individual buys and sells of a ticker to see cost basis, gains, and a trend projection. Skip this if you don't track holdings share-by-share.</p>

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
            <td><ConfirmButton onconfirm={() => lots.remove(l.id)} title="Delete lot" /></td>
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
  .lede {
    text-align: center;
    color: var(--color-soot);
    font-family: var(--font-body);
    max-width: 44rem;
    margin: 0 auto 1.6rem;
    line-height: 1.5;
  }
  .lede strong {
    color: var(--color-gilt);
    font-weight: 400;
  }
  .block {
    border: 1px solid var(--color-etch);
    border-radius: 10px;
    background: var(--color-panel);
    box-shadow: var(--bevel);
    padding: 1.2rem 1.4rem 1.5rem;
    margin-bottom: 2.5rem;
  }
  .section {
    font-family: var(--font-display);
    color: var(--color-gilt);
    letter-spacing: 0.1em;
    font-size: 1rem;
    text-align: center;
    margin: 0 0 0.2rem;
  }
  .hint {
    text-align: center;
    color: var(--color-dim);
    font-family: var(--font-body);
    font-size: 0.85rem;
    margin: 0 0 1rem;
  }
  .add .lbl {
    width: 11rem;
  }
  .add .cat {
    width: 8rem;
    text-transform: lowercase;
  }
  .summary {
    text-align: center;
    font-family: var(--font-body);
    color: var(--color-parchment);
    margin: 0.6rem 0 1rem;
  }
  .summary strong {
    font-family: var(--font-meter);
    color: var(--color-copper);
    font-size: 1.15rem;
  }
  .autos {
    width: 100%;
  }
  .autos .cap {
    text-align: left;
    text-transform: capitalize;
  }
  .autos .paused {
    opacity: 0.45;
  }
</style>
