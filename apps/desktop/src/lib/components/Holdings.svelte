<script lang="ts">
  import { onMount } from "svelte";
  import { ASSET_CLASSES, DRIFT_THRESHOLD_PP, type AssetClassId } from "@mainspring/engine";
  import { formatUsd } from "$lib/format";
  import { lots } from "$lib/stores/lots.svelte";
  import { recurring } from "$lib/stores/recurring.svelte";
  import { market } from "$lib/stores/market.svelte";
  import { registers } from "$lib/stores/registers.svelte";
  import { setupForm } from "$lib/stores/setup-form.svelte";
  import { hints } from "$lib/stores/hints.svelte";
  import FanChart from "./FanChart.svelte";
  import ConfirmButton from "./ConfirmButton.svelte";

  const CLASS_LABEL: Record<string, string> = Object.fromEntries(ASSET_CLASSES.map((c) => [c.id, c.label]));
  const classLabel = (id: string) => (id === "unassigned" ? "Unassigned" : (CLASS_LABEL[id] ?? id));
  const pct1 = (x: number) => `${(x * 100).toFixed(1)}%`;

  const today = () => new Date().toISOString().slice(0, 10);
  let draft = $state({ ticker: "", side: "buy" as "buy" | "sell", shares: 0, price: 0, fee: 0, date: today() });

  onMount(() => {
    void lots.load();
    void recurring.load();
    void registers.load();
  });

  const report = $derived(registers.report);

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
  <header class="title">The Registers</header>
  {#if hints.show}
    <p class="lede">What you actually hold, regrouped by asset class and read against the mix you designed in the <strong>Calibre</strong>. Track investments two ways: <strong>automatic contributions</strong> (recurring transfers like Acorns — they feed your net-worth projection) and <strong>tracked positions</strong> (individual buys/sells of a ticker, which the drift view groups by class).</p>
  {/if}

  {#if positions.length > 0}
    <div class="block registers">
      <h2 class="section">Registers — drift vs. your design</h2>
      {#if hints.show}
        <p class="hint">Your tracked positions, regrouped by asset class and compared with the <strong>{setupForm.calibre.name}</strong> mix you designed in the Calibre. Drift past ±{DRIFT_THRESHOLD_PP} points is flagged. This is a modeling instrument — it shows the trade-offs, never a "you should."</p>
      {/if}

      {#if registers.unassigned.length > 0}
        <div class="assign">
          <p class="assign-lede">Assign a class to each holding so it can be grouped (a one-time pick):</p>
          {#each registers.unassigned as t (t)}
            <label class="assign-row">
              <span class="tk mono">{t}</span>
              <select onchange={(e) => registers.setClass(t, (e.currentTarget as HTMLSelectElement).value as AssetClassId)}>
                <option value="" selected disabled>Pick a class…</option>
                {#each ASSET_CLASSES as c (c.id)}<option value={c.id}>{c.label}</option>{/each}
              </select>
            </label>
          {/each}
        </div>
      {/if}

      {#if report.total > 0}
        <div class="drift">
          {#each report.rows as row (row.classId)}
            {@const over = row.driftPp > 0}
            <div class="drift-row" class:flagged={row.drifted}>
              <div class="drift-head">
                <span class="cls">{classLabel(row.classId)}{#if row.estimated}<span class="est"> · est.</span>{/if}</span>
                <span class="nums mono">
                  {pct1(row.actual)} <span class="of">held</span> · {pct1(row.target)} <span class="of">target</span>
                  {#if row.drifted}<span class="chip" class:over class:under={!over}>{over ? "+" : ""}{row.driftPp.toFixed(1)} pp</span>{/if}
                </span>
              </div>
              <div class="bar">
                <div class="target-tick" style="left: {Math.min(100, row.target * 100)}%"></div>
                <div class="fill" class:over={row.drifted && over} class:under={row.drifted && !over} style="width: {Math.min(100, row.actual * 100)}%"></div>
              </div>

              {#if row.drifted && !over}
                {@const m = registers.monthsToClose(row)}
                <p class="helper">
                  Underweight. {#if m === null}Add contributions to route toward this class.{:else if m === 0}Already at target.{:else}Directing your current contributions here closes the gap in about <strong>{m}</strong> month{m === 1 ? "" : "s"} — no selling, no tax.{/if}
                </p>
              {:else if row.drifted && over && row.classId !== "unassigned"}
                {@const plan = registers.sellPlanFor(row)}
                {#if plan}
                  <p class="helper">
                    Overweight. Trimming ~<strong>{formatUsd(plan.sellDollars)}</strong> back to target realizes
                    {formatUsd(plan.longTermGain)} long-term / {formatUsd(plan.shortTermGain)} short-term in gains —
                    an estimated tax of <strong>{formatUsd(Number(plan.tax.total.toString()))}</strong>
                    <span class="est">(LT {formatUsd(Number(plan.tax.longTermTax.toString()))} · ST {formatUsd(Number(plan.tax.shortTermTax.toString()))} · NIIT {formatUsd(Number(plan.tax.niit.toString()))})</span>.
                    Or let new contributions to other classes dilute it down — no tax.
                  </p>
                {/if}
              {/if}
            </div>
          {/each}
        </div>
        <p class="disclaimer">Drift and rebalance costs are modeled from your lots, cached prices, and tax profile — an estimate for weighing trade-offs, not tax advice. Tax-advantaged accounts (401k/IRA) rebalance without capital-gains tax; account linkage is not yet modeled here.</p>
      {:else}
        <p class="empty">Assign classes above to see how your holdings sit against your design.</p>
      {/if}
    </div>
  {/if}

  <div class="block">
    <h2 class="section">Return assumptions (μ / σ)</h2>
    {#if hints.show}
      <p class="hint">A reference ticker's local price history sets the mean return (μ) and volatility (σ) the forecast uses. Persisted; VTI by default.</p>
    {/if}
    <div class="market">
      <label>
        Reference ticker
        <input bind:value={market.ticker} class="ticker" />
      </label>
      <button class="run" onclick={() => market.refresh()} disabled={market.loading}>
        {market.loading ? "Fetching…" : "Refresh market data"}
      </button>
      {#if market.mu !== null}
        <span class="stats">
          μ {Math.round(market.mu * 1000) / 10}% · σ {Math.round((market.sigma ?? 0) * 1000) / 10}%
          <span class="caption">({market.samples} days{market.refreshedAt ? `, updated ${new Date(market.refreshedAt).toLocaleDateString()}` : ", cached"})</span>
        </span>
      {/if}
      {#if market.error}<p class="warn">{market.error}</p>{/if}
    </div>
  </div>

  <div class="block">
    <h2 class="section">Recurring contributions</h2>
    <p class="moved">
      Auto-invest transfers now live under <strong>Outflows → Automatic investments</strong>, beside the recurring
      bills they share a shape with.
      {#if Number(recurring.investmentsAnnual.toString()) > 0}
        Currently <strong class="kept">{formatUsd(Number(recurring.investmentsAnnual.toString()))}/yr</strong> across
        {recurring.investments.length} transfer{recurring.investments.length === 1 ? "" : "s"}.
      {/if}
    </p>
  </div>

  <h2 class="section">Tracked positions &amp; lots</h2>
  {#if hints.show}
    <p class="hint">Record individual buys and sells of a ticker to see cost basis, gains, and a trend projection. Skip this if you don't track holdings share-by-share.</p>
  {/if}

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
  .market {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 1rem;
    flex-wrap: wrap;
  }
  .market label {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    color: var(--color-soot);
    font-family: var(--font-body);
    font-size: 0.85rem;
  }
  .market .ticker {
    width: 6rem;
    text-transform: uppercase;
    text-align: center;
  }
  .stats {
    font-family: var(--font-meter);
    color: var(--color-copper);
    font-variant-numeric: tabular-nums;
  }
  .caption {
    display: block;
    color: var(--color-dim);
    font-size: 0.78rem;
    margin-top: 0.25rem;
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
  .moved {
    text-align: center;
    color: var(--color-soot);
    font-family: var(--font-body);
    font-size: 0.88rem;
    line-height: 1.6;
    margin: 0;
  }
  .moved strong {
    color: var(--color-gilt);
    font-weight: 400;
  }
  .moved strong.kept {
    color: var(--color-lime-rust);
    font-family: var(--font-meter);
  }
  .registers .assign {
    max-width: 32rem;
    margin: 0 auto 1.4rem;
  }
  .assign-lede {
    text-align: center;
    color: var(--color-dim);
    font-family: var(--font-body);
    font-size: 0.85rem;
    margin: 0 0 0.7rem;
  }
  .assign-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.6rem;
    padding: 0.35rem 0;
  }
  .assign-row .tk {
    font-family: var(--font-meter);
  }
  .drift {
    display: flex;
    flex-direction: column;
    gap: 1.1rem;
    margin-top: 0.5rem;
  }
  .drift-row {
    border-left: 2px solid transparent;
    padding-left: 0.8rem;
  }
  .drift-row.flagged {
    border-left-color: var(--color-copper);
  }
  .drift-head {
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    gap: 1rem;
    flex-wrap: wrap;
    margin-bottom: 0.4rem;
  }
  .drift-head .cls {
    font-family: var(--font-display);
    color: var(--color-gilt);
    letter-spacing: 0.05em;
  }
  .drift-head .nums {
    color: var(--color-parchment);
    font-variant-numeric: tabular-nums;
    font-size: 0.9rem;
  }
  .drift-head .of {
    color: var(--color-soot);
    font-family: var(--font-body);
    font-size: 0.78rem;
  }
  .est {
    color: var(--color-dim);
    font-size: 0.78rem;
  }
  .chip {
    margin-left: 0.5rem;
    padding: 0.05rem 0.4rem;
    border-radius: 4px;
    font-size: 0.78rem;
  }
  .chip.over {
    color: var(--color-oxblood);
    border: 1px solid var(--color-oxblood);
  }
  .chip.under {
    color: var(--color-copper);
    border: 1px solid var(--color-copper);
  }
  .bar {
    position: relative;
    height: 10px;
    background: var(--color-coal);
    border: 1px solid var(--color-etch);
    border-radius: 5px;
    overflow: hidden;
  }
  .bar .fill {
    height: 100%;
    background: var(--color-brass);
  }
  .bar .fill.over {
    background: var(--color-oxblood);
  }
  .bar .fill.under {
    background: var(--color-copper);
  }
  .bar .target-tick {
    position: absolute;
    top: -2px;
    bottom: -2px;
    width: 2px;
    background: var(--color-parchment);
    z-index: 1;
  }
  .helper {
    color: var(--color-soot);
    font-family: var(--font-body);
    font-size: 0.83rem;
    margin: 0.5rem 0 0;
    line-height: 1.5;
  }
  .helper strong {
    color: var(--color-parchment);
    font-family: var(--font-meter);
  }
</style>
