<script lang="ts">
  import { Money } from "@mainspring/schema";
  import { bucketLabel } from "$lib/buckets";
  import { formatMoney } from "$lib/format";
  import { profile, setDialPct } from "$lib/stores/profile.svelte";
  import { view } from "$lib/stores/derived.svelte";
  import { session } from "$lib/stores/session.svelte";
  import { forecast } from "$lib/stores/forecast.svelte";
  import { market } from "$lib/stores/market.svelte";
  import Gauge from "./Gauge.svelte";
  import TakeHomeReadout from "./TakeHomeReadout.svelte";
  import FireSummary from "./FireSummary.svelte";
  import FanChart from "./FanChart.svelte";
  import NetWorthChart from "./NetWorthChart.svelte";
  import Proportions from "./Proportions.svelte";
  import ScenarioBar from "./ScenarioBar.svelte";
  import Almanac from "./Almanac.svelte";

  const v = $derived(view.current);

  const propSlices = $derived(v.whereItGoes.map((s) => ({ label: s.label, amount: Number(s.amount.toString()) })));

  // Every dollar of income as a read-only dial — taxes, essentials (bills),
  // spending, investing, goals, leftover. Consuming slices read as outflow (red).
  const CONSUMING = new Set(["Taxes", "Essentials", "Spending"]);
  const grossN = $derived(Number(v.gross.toString()));
  const flowDials = $derived(
    v.whereItGoes
      .filter((s) => Number(s.amount.toString()) > 0)
      .map((s) => ({
        label: s.label,
        pct: grossN > 0 ? Number(s.amount.toString()) / grossN : 0,
        amount: formatMoney(s.amount),
        outflow: CONSUMING.has(s.label),
      })),
  );

  function allocFor(bucket: string, base: string) {
    return v.buckets.find((b) => b.bucket === bucket && b.base === base);
  }
</script>

<section class="console">
  <header class="title">
    <span>MAINSPRING</span>
    <button class="edit" onclick={() => (session.configured = false)}>Edit setup</button>
  </header>

  <div class="dashboard">
    <div class="panel">
      <h3>Net worth → coast & FI</h3>
      <NetWorthChart
        currentBalance={profile.plan.currentBalance}
        annualContribution={v.totalContributions}
        realReturn={profile.plan.realReturn}
        currentAge={profile.plan.currentAge}
        targetRetireAge={profile.plan.targetRetireAge}
        coast={v.fire.coastNumber}
        fi={v.fire.fiNumber}
        discretionary={v.commitments.add(profile.variableAnnualSpending ?? Money.zero())}
      />
    </div>
    <div class="panel">
      <h3>Where every dollar goes</h3>
      <Proportions slices={propSlices} total={Number(v.gross.toString())} />
    </div>
  </div>

  <div class="readouts">
    <TakeHomeReadout net={v.net} gross={v.gross} tax={v.tax.total} />
    <FireSummary fire={v.fire} savingsRate={v.savingsRate} employerMatch={v.employerMatch} />
  </div>

  <div class="gauges">
    {#each profile.dials as dial, i (dial.bucket + "/" + dial.base)}
      {@const a = allocFor(dial.bucket, dial.base)}
      <Gauge
        label={bucketLabel(dial.bucket)}
        pct={Number(dial.pct)}
        amount={formatMoney(a ? a.amount : Money.zero())}
        clamped={a?.clampedByCap ?? false}
        onChange={(p) => setDialPct(i, p)}
      />
    {/each}
  </div>

  {#if v.overAllocated}
    <p class="warn">Allocations exceed a base — trim a dial.</p>
  {/if}

  <h3 class="flow-title">Where your income goes</h3>
  <p class="flow-sub">Every dollar of gross income as a dial — from taxes to subscriptions. Read-only; adjust the levers above or in Outflows.</p>
  <div class="gauges flow-gauges">
    {#each flowDials as f (f.label)}
      <Gauge label={f.label} pct={f.pct} amount={f.amount} outflow={f.outflow} />
    {/each}
  </div>

  <div class="forecast">
    <div class="market">
      <label>
        Ticker
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

    <button class="run" onclick={() => forecast.run()} disabled={forecast.running}>
      {forecast.running ? "Running…" : "Run forecast"}
    </button>
    {#if forecast.error}
      <p class="warn">{forecast.error}</p>
    {/if}
    {#if forecast.result}
      <p class="success">
        Success probability:
        <strong>{Math.round(forecast.result.successProbability * 100)}%</strong>
        <span class="caption">— Monte Carlo projection from historical trends, an estimate, not advice.</span>
      </p>
      <FanChart forecast={forecast.result} currentAge={profile.plan.currentAge} />
    {/if}
  </div>

  <ScenarioBar />
</section>

<Almanac />

<style>
  .console {
    max-width: 70rem;
    margin: 0 auto;
    padding: 2rem 1.5rem 4rem;
  }
  .dashboard {
    display: grid;
    grid-template-columns: 1.4fr 1fr;
    gap: 1.25rem;
    margin-bottom: 2.5rem;
  }
  @media (max-width: 720px) {
    .dashboard {
      grid-template-columns: 1fr;
    }
  }
  .panel {
    border: 1px solid var(--color-etch);
    border-radius: 10px;
    background: var(--color-panel);
    box-shadow: var(--bevel);
    padding: 1rem 1.1rem;
    display: flex;
    flex-direction: column;
    justify-content: center;
  }
  .panel h3 {
    font-family: var(--font-display);
    color: var(--color-gilt);
    letter-spacing: 0.08em;
    font-size: 0.9rem;
    margin: 0 0 0.6rem;
    text-align: center;
  }
  .title {
    display: flex;
    align-items: center;
    justify-content: center;
    position: relative;
    font-family: var(--font-display);
    letter-spacing: 0.35em;
    color: var(--color-brass);
    font-size: 1.4rem;
    margin-bottom: 1.6rem;
  }
  .edit {
    position: absolute;
    right: 0;
    background: transparent;
    border: 1px solid var(--color-etch);
    border-radius: 6px;
    color: var(--color-soot);
    font-family: var(--font-body);
    letter-spacing: normal;
    font-size: 0.8rem;
    padding: 0.35rem 0.7rem;
    cursor: pointer;
  }
  .edit:hover {
    color: var(--color-gilt);
    border-color: var(--color-gilt);
  }
  .readouts {
    display: flex;
    gap: 1.25rem;
    justify-content: center;
    flex-wrap: wrap;
    margin-bottom: 2.5rem;
  }
  .gauges {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
    gap: 1.5rem 1rem;
    justify-items: center;
  }
  .flow-title {
    text-align: center;
    font-family: var(--font-display);
    color: var(--color-gilt);
    letter-spacing: 0.1em;
    font-size: 0.95rem;
    margin: 3rem 0 0.2rem;
  }
  .flow-sub {
    text-align: center;
    color: var(--color-dim);
    font-family: var(--font-body);
    font-size: 0.82rem;
    margin: 0 0 1.5rem;
  }
  .flow-gauges {
    border-top: 1px solid var(--color-etch);
    padding-top: 1.8rem;
  }
  .warn {
    margin-top: 1.5rem;
    text-align: center;
    color: var(--color-oxblood);
    font-family: var(--font-body);
  }
  .forecast {
    margin-top: 3rem;
    border-top: 1px solid var(--color-etch);
    padding-top: 2rem;
    text-align: center;
  }
  .market {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 1rem;
    flex-wrap: wrap;
    margin-bottom: 1.5rem;
  }
  .market label {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    color: var(--color-soot);
    font-family: var(--font-body);
    font-size: 0.85rem;
  }
  .ticker {
    width: 5rem;
    background: var(--color-coal);
    border: 1px solid var(--color-etch);
    border-radius: 6px;
    color: var(--color-parchment);
    font-family: var(--font-meter);
    text-transform: uppercase;
    padding: 0.4rem 0.5rem;
  }
  .stats {
    font-family: var(--font-meter);
    color: var(--color-copper);
    font-variant-numeric: tabular-nums;
  }
  .run {
    background: transparent;
    border: 1px solid var(--color-brass);
    border-radius: 8px;
    color: var(--color-brass);
    font-family: var(--font-display);
    letter-spacing: 0.1em;
    font-size: 0.95rem;
    padding: 0.6rem 1.6rem;
    cursor: pointer;
  }
  .run:hover:not(:disabled) {
    background: var(--color-brass);
    color: var(--color-coal);
  }
  .run:disabled {
    opacity: 0.6;
    cursor: default;
  }
  .success {
    font-family: var(--font-body);
    color: var(--color-parchment);
    margin: 1.25rem 0;
  }
  .success strong {
    font-family: var(--font-meter);
    color: var(--color-lime-rust);
    font-size: 1.2rem;
  }
  .caption {
    display: block;
    color: var(--color-dim);
    font-size: 0.78rem;
    margin-top: 0.25rem;
  }
</style>
