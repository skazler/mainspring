<script lang="ts">
  import { Money } from "@mainspring/schema";
  import { bucketLabel, isPreTax } from "$lib/buckets";
  import { formatMoney } from "$lib/format";
  import { profile, setDialPct } from "$lib/stores/profile.svelte";
  import { view } from "$lib/stores/derived.svelte";
  import { session } from "$lib/stores/session.svelte";
  import { forecast } from "$lib/stores/forecast.svelte";
  import { market } from "$lib/stores/market.svelte";
  import { hints } from "$lib/stores/hints.svelte";
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

  // Editable contribution dials, split by tax treatment.
  const dialIdx = $derived(profile.dials.map((d, i) => ({ d, i })));
  const preTaxDials = $derived(dialIdx.filter((x) => isPreTax(x.d.bucket)));
  const postTaxDialsEditable = $derived(dialIdx.filter((x) => !isPreTax(x.d.bucket)));

  // Read-only "post-tax distribution": where take-home (net) actually goes.
  const sliceOf = (label: string) => v.whereItGoes.find((s) => s.label === label)?.amount ?? Money.zero();
  const netN = $derived(Number(v.net.toString()));
  const CONSUMING = new Set(["Bills & essentials", "Spending"]);
  const distribution = $derived(
    (() => {
      const preTaxContrib = v.buckets
        .filter((b) => isPreTax(b.bucket))
        .reduce((sum, b) => sum.add(b.amount), Money.zero());
      const taxableInvesting = v.ownContributions.subtract(preTaxContrib);
      const rows = [
        { label: "Bills & essentials", amount: sliceOf("Bills & essentials") },
        { label: "Spending", amount: sliceOf("Spending") },
        { label: "Goals", amount: sliceOf("Goals") },
        { label: "Taxable investing", amount: taxableInvesting },
      ];
      return rows
        .filter((r) => Number(r.amount.toString()) > 0)
        .map((r) => ({
          label: r.label,
          pct: netN > 0 ? Number(r.amount.toString()) / netN : 0,
          amount: formatMoney(r.amount),
          outflow: CONSUMING.has(r.label),
        }));
    })(),
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

  <div class="panel graph">
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
    <div class="dollar-bar">
      <span class="bar-label">Where every dollar goes</span>
      <Proportions slices={propSlices} total={Number(v.gross.toString())} />
    </div>
  </div>

  <div class="readouts">
    <TakeHomeReadout net={v.net} gross={v.gross} tax={v.tax.total} />
    <FireSummary fire={v.fire} savingsRate={v.savingsRate} employerMatch={v.employerMatch} />
  </div>

  {#if preTaxDials.length > 0}
    <h3 class="group-title">Pre-tax contributions</h3>
    <div class="gauges">
      {#each preTaxDials as { d, i } (d.bucket + "/" + d.base)}
        {@const a = allocFor(d.bucket, d.base)}
        <Gauge
          label={bucketLabel(d.bucket)}
          pct={Number(d.pct)}
          amount={formatMoney(a ? a.amount : Money.zero())}
          clamped={a?.clampedByCap ?? false}
          onChange={(p) => setDialPct(i, p)}
        />
      {/each}
    </div>
  {/if}

  {#if postTaxDialsEditable.length > 0}
    <h3 class="group-title">Post-tax contributions</h3>
    <div class="gauges">
      {#each postTaxDialsEditable as { d, i } (d.bucket + "/" + d.base)}
        {@const a = allocFor(d.bucket, d.base)}
        <Gauge
          label={bucketLabel(d.bucket)}
          pct={Number(d.pct)}
          amount={formatMoney(a ? a.amount : Money.zero())}
          clamped={a?.clampedByCap ?? false}
          onChange={(p) => setDialPct(i, p)}
        />
      {/each}
    </div>
  {/if}

  {#if v.overAllocated}
    <p class="warn">Allocations exceed a base — trim a dial.</p>
  {/if}

  <h3 class="flow-title">Post-tax distribution</h3>
  {#if hints.show}
    <p class="flow-sub">Where your take-home pay lands after taxes — as a share of net income. Read-only; adjust the levers above or in Outflows.</p>
  {/if}
  <div class="gauges flow-gauges">
    {#each distribution as f (f.label)}
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
  .panel.graph {
    margin-bottom: 2.5rem;
  }
  /* Slim "where every dollar goes" bar integrated under the chart. */
  .dollar-bar {
    margin-top: 1rem;
    padding-top: 0.9rem;
    border-top: 1px solid var(--color-etch);
  }
  .bar-label {
    display: block;
    text-align: center;
    font-family: var(--font-body);
    color: var(--color-dim);
    font-size: 0.72rem;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    margin-bottom: 0.5rem;
  }
  .group-title {
    text-align: center;
    font-family: var(--font-display);
    color: var(--color-gilt);
    letter-spacing: 0.1em;
    font-size: 0.9rem;
    margin: 0 0 1.2rem;
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
    margin-bottom: 2.2rem;
  }
  .flow-title {
    text-align: center;
    font-family: var(--font-display);
    color: var(--color-gilt);
    letter-spacing: 0.1em;
    font-size: 0.95rem;
    border-top: 1px solid var(--color-etch);
    padding-top: 1.8rem;
    margin: 1.5rem 0 0.2rem;
  }
  .flow-sub {
    text-align: center;
    color: var(--color-dim);
    font-family: var(--font-body);
    font-size: 0.82rem;
    margin: 0.2rem 0 1.5rem;
  }
  .flow-gauges {
    margin-top: 1.2rem;
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
