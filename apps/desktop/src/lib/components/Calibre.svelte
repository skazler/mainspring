<script lang="ts">
  import { onMount } from "svelte";
  import { ASSET_CLASSES, assetClass } from "@mainspring/engine";
  import { calibre } from "$lib/stores/calibre.svelte";
  import { setupForm } from "$lib/stores/setup-form.svelte";
  import { view } from "$lib/stores/derived.svelte";
  import { hints } from "$lib/stores/hints.svelte";
  import { PRESETS } from "$lib/calibre-presets";
  import { CLASS_WHY, DIVERSIFICATION_WHY } from "$lib/calibre-why";
  import Gauge from "./Gauge.svelte";

  let name = $state(setupForm.calibre.name);

  onMount(() => {
    calibre.resetToApplied();
    name = setupForm.calibre.name;
    void calibre.loadHistory();
  });

  const v = $derived(view.current);
  const working = $derived(calibre.working);
  const applied = $derived(calibre.applied);
  const blendedById = $derived(Object.fromEntries(calibre.blended.map((b) => [b.id, b])));

  const pct = (n: number) => `${(n * 100).toFixed(1)}%`;
  const signed = (n: number) => `${n >= 0 ? "+" : ""}${(n * 100).toFixed(1)}%`;

  // Weighted-average σ (no diversification) → the mix is calmer when portfolio σ is below it.
  const weightedSigma = $derived(
    (() => {
      const total = ASSET_CLASSES.reduce((a, c) => a + calibre.weights[c.id], 0);
      if (total <= 0) return 0;
      return ASSET_CLASSES.reduce((a, c) => a + (calibre.weights[c.id] / total) * (blendedById[c.id]?.sigma ?? 0), 0);
    })(),
  );
  const diversified = $derived(working.sigma > 0 && working.sigma < weightedSigma - 1e-6);
</script>

<section class="calibre">
  <header class="title">The Calibre</header>
  {#if hints.show}
    <p class="lede">Design an asset-class mix, not a stock pick. Turn the gauges and watch expected real return, volatility, and success probability respond — the chosen calibre becomes the return assumption behind your Plan's forecast. <em>A modeling instrument, not advice.</em></p>
  {/if}

  <div class="presets">
    {#each PRESETS as p (p.name)}
      <button class="preset" onclick={() => calibre.loadPreset(p.weights(v.fire.yearsToFI))}>
        <span class="pname">{p.name}</span>
        <span class="pchar">{p.character}</span>
      </button>
    {/each}
  </div>

  <div class="gauges">
    {#each ASSET_CLASSES as c, i (c.id)}
      {@const b = blendedById[c.id]}
      <Gauge
        label={c.label}
        tag={b?.source === "historical" ? "historical" : "assumed"}
        pct={calibre.weights[c.id]}
        amount={b ? `μ ${(b.mu * 100).toFixed(1)}% · σ ${(b.sigma * 100).toFixed(1)}%` : ""}
        onChange={(w) => calibre.setWeight(c.id, w)}
      />
    {/each}
  </div>
  <p class="budget" class:full={calibre.remaining < 0.001}>
    {calibre.remaining < 0.001 ? "Fully allocated" : `${pct(calibre.remaining)} unallocated`}
  </p>

  <div class="readout">
    <div class="stat"><span class="k">Expected real return</span><span class="v">{pct(working.mu)}<span class="delta">{signed(working.mu - applied.mu)}</span></span></div>
    <div class="stat"><span class="k">Volatility (σ)</span><span class="v">{pct(working.sigma)}<span class="delta">{signed(working.sigma - applied.sigma)}</span></span></div>
    <div class="stat"><span class="k">Typical bad year</span><span class="v neg">{pct(working.badYear)}</span></div>
    <div class="stat">
      <span class="k">Plan success</span>
      <span class="v">
        {#if calibre.successWorking !== null}
          {Math.round(calibre.successWorking * 100)}%{#if calibre.successApplied !== null}<span class="delta">from {Math.round(calibre.successApplied * 100)}%</span>{/if}
        {:else}{calibre.running ? "…" : "—"}{/if}
      </span>
    </div>
  </div>

  {#if diversified}
    <p class="diversify">◇ The mix is calmer than its parts (σ {pct(working.sigma)} vs weighted {pct(weightedSigma)}).{#if hints.show} {DIVERSIFICATION_WHY}{/if}</p>
  {/if}

  <div class="fit">
    <input class="name" placeholder="Name this calibre" bind:value={name} />
    <button class="run" onclick={() => calibre.fit(name)}>Fit this calibre</button>
    <span class="fit-note">writes the mix to your Plan's forecast</span>
  </div>

  {#if hints.show}
    <div class="why">
      <h3>Why each lever matters</h3>
      {#each ASSET_CLASSES as c (c.id)}
        {#if calibre.weights[c.id] > 0.001}
          <p><b>{c.label}</b> <span class="src">({blendedById[c.id]?.source})</span> — {CLASS_WHY[c.id]}</p>
        {/if}
      {/each}
    </div>
  {/if}

  <p class="disclaimer">μ/σ are derived from local history where available (badged “historical”), else documented long-run assumptions (“assumed”) — planning inputs, not predictions. Set the reference tickers' history by refreshing them in Registers. Informational, not advice.</p>
</section>

<style>
  .calibre {
    max-width: 70rem;
    margin: 0 auto;
    padding: 2rem 1.5rem 4rem;
  }
  .title {
    font-family: var(--font-display);
    letter-spacing: 0.2em;
    color: var(--color-brass);
    font-size: 1.3rem;
    text-align: center;
    margin-bottom: 0.5rem;
  }
  .lede {
    text-align: center;
    color: var(--color-soot);
    font-family: var(--font-body);
    max-width: 46rem;
    margin: 0 auto 1.5rem;
    line-height: 1.5;
  }
  .lede em {
    color: var(--color-dim);
  }
  .presets {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(13rem, 1fr));
    gap: 0.75rem;
    margin-bottom: 2rem;
  }
  .preset {
    text-align: left;
    background: var(--color-panel);
    border: 1px solid var(--color-etch);
    border-radius: 8px;
    padding: 0.7rem 0.9rem;
    cursor: pointer;
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
  }
  .preset:hover {
    border-color: var(--color-brass);
  }
  .pname {
    font-family: var(--font-display);
    color: var(--color-gilt);
    letter-spacing: 0.06em;
  }
  .pchar {
    font-family: var(--font-body);
    color: var(--color-soot);
    font-size: 0.8rem;
  }
  .gauges {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
    gap: 1.5rem 1rem;
    justify-items: center;
  }
  .budget {
    text-align: center;
    font-family: var(--font-body);
    color: var(--color-copper);
    font-size: 0.85rem;
    margin: 0.75rem 0 2rem;
  }
  .budget.full {
    color: var(--color-lime-rust);
  }
  .readout {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(11rem, 1fr));
    gap: 1rem;
    border: 1px solid var(--color-etch);
    border-radius: 10px;
    background: var(--color-panel);
    box-shadow: var(--bevel);
    padding: 1.1rem 1.3rem;
  }
  .stat {
    display: flex;
    flex-direction: column;
    gap: 0.15rem;
  }
  .stat .k {
    font-family: var(--font-body);
    color: var(--color-soot);
    font-size: 0.75rem;
    letter-spacing: 0.04em;
  }
  .stat .v {
    font-family: var(--font-meter);
    color: var(--color-gilt);
    font-size: 1.35rem;
    font-variant-numeric: tabular-nums;
  }
  .stat .v.neg {
    color: var(--color-oxblood);
  }
  .stat .delta {
    display: block;
    font-size: 0.75rem;
    color: var(--color-soot);
  }
  .diversify {
    text-align: center;
    color: var(--color-patina);
    font-family: var(--font-body);
    font-size: 0.85rem;
    margin: 1rem 0 0;
  }
  .fit {
    display: flex;
    align-items: center;
    gap: 0.6rem;
    justify-content: center;
    flex-wrap: wrap;
    margin: 1.75rem 0 0;
  }
  .name {
    background: var(--color-coal);
    border: 1px solid var(--color-etch);
    border-radius: 6px;
    color: var(--color-parchment);
    font-family: var(--font-body);
    padding: 0.5rem 0.7rem;
    width: 14rem;
  }
  .run {
    background: var(--color-brass);
    color: var(--color-coal);
    border: none;
    border-radius: 8px;
    font-family: var(--font-display);
    letter-spacing: 0.08em;
    padding: 0.55rem 1.3rem;
    cursor: pointer;
  }
  .fit-note {
    font-family: var(--font-body);
    color: var(--color-dim);
    font-size: 0.8rem;
  }
  .why {
    margin: 2rem auto 0;
    max-width: 46rem;
  }
  .why h3 {
    font-family: var(--font-display);
    color: var(--color-gilt);
    letter-spacing: 0.08em;
    font-size: 0.9rem;
    margin: 0 0 0.5rem;
  }
  .why p {
    font-family: var(--font-body);
    color: var(--color-soot);
    font-size: 0.85rem;
    margin: 0.35rem 0;
    line-height: 1.5;
  }
  .why b {
    color: var(--color-parchment);
    font-weight: 400;
  }
  .why .src {
    color: var(--color-dim);
    font-size: 0.75rem;
  }
  .disclaimer {
    text-align: center;
    color: var(--color-dim);
    font-family: var(--font-body);
    font-size: 0.75rem;
    margin: 2rem auto 0;
    max-width: 46rem;
  }
</style>
