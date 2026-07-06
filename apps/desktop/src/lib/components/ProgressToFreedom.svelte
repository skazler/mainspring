<script lang="ts">
  import type { Money } from "@mainspring/schema";
  import { formatUsd } from "$lib/format";

  interface Props {
    currentBalance: Money;
    coast: Money;
    fi: Money;
  }
  let { currentBalance, coast, fi }: Props = $props();

  const bal = $derived(Number(currentBalance.toString()));
  const coastN = $derived(Number(coast.toString()));
  const fiN = $derived(Number(fi.toString()));

  // The journey runs 0 → FI number; coast sits somewhere along it. Clamp to [0,1].
  const clamp = (n: number) => Math.max(0, Math.min(1, n));
  const fillPct = $derived(fiN > 0 ? clamp(bal / fiN) : 0);
  const coastPct = $derived(fiN > 0 ? clamp(coastN / fiN) : 0);
  const toFI = $derived(fiN > 0 ? Math.round((bal / fiN) * 100) : 0);
  const toCoast = $derived(coastN > 0 ? Math.round((bal / coastN) * 100) : 0);
</script>

<div class="meter">
  <div class="head">
    <span class="label">Progress to freedom</span>
    <span class="status">
      {#if fiN <= 0}
        set your expenses to chart the road
      {:else if bal >= fiN}
        <span class="reached">Financially independent 🎉</span>
      {:else if bal >= coastN}
        past your <b>coast</b> — growth alone reaches FI
      {:else}
        <b>{toFI}%</b> to FI · {toCoast}% to coast
      {/if}
    </span>
  </div>

  <div class="track">
    <div class="fill" style="width:{fillPct * 100}%"></div>
    {#if fiN > 0 && coastN < fiN}
      <div class="tick coast" style="left:{coastPct * 100}%"><span class="flag">coast</span></div>
    {/if}
    <div class="now" style="left:{fillPct * 100}%"></div>
  </div>

  <div class="scale">
    <span class="mono start">{formatUsd(bal)}<span class="cap">now</span></span>
    <span class="mono end">{formatUsd(fiN)}<span class="cap">FI number</span></span>
  </div>
</div>

<style>
  .meter {
    max-width: 46rem;
    margin: 0 auto 2.5rem;
  }
  .head {
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    margin-bottom: 0.5rem;
    gap: 1rem;
    flex-wrap: wrap;
  }
  .label {
    font-family: var(--font-display);
    color: var(--color-gilt);
    letter-spacing: 0.1em;
    font-size: 0.9rem;
  }
  .status {
    font-family: var(--font-body);
    color: var(--color-soot);
    font-size: 0.85rem;
  }
  .status b {
    color: var(--color-brass);
    font-family: var(--font-meter);
  }
  .status .reached {
    color: var(--color-lime-rust);
  }
  .track {
    position: relative;
    height: 18px;
    background: var(--color-coal);
    border: 1px solid var(--color-etch);
    border-radius: 9px;
    box-shadow: var(--bevel);
    overflow: visible;
  }
  .fill {
    position: absolute;
    top: 0;
    left: 0;
    height: 100%;
    background: linear-gradient(90deg, var(--color-copper), var(--color-brass));
    border-radius: 9px 0 0 9px;
    transition: width 200ms cubic-bezier(0.2, 0.9, 0.3, 1.2);
  }
  .tick.coast {
    position: absolute;
    top: -3px;
    height: 24px;
    width: 2px;
    background: var(--color-patina);
    transform: translateX(-1px);
  }
  .flag {
    position: absolute;
    top: -1.15rem;
    left: 50%;
    transform: translateX(-50%);
    font-family: var(--font-body);
    font-size: 0.62rem;
    letter-spacing: 0.06em;
    color: var(--color-patina);
    white-space: nowrap;
  }
  .now {
    position: absolute;
    top: 50%;
    width: 12px;
    height: 12px;
    border-radius: 50%;
    background: var(--color-gilt);
    border: 2px solid var(--color-coal);
    transform: translate(-50%, -50%);
  }
  .scale {
    display: flex;
    justify-content: space-between;
    margin-top: 0.55rem;
    font-family: var(--font-meter);
    color: var(--color-parchment);
    font-size: 0.9rem;
  }
  .scale .end {
    text-align: right;
  }
  .cap {
    display: block;
    color: var(--color-dim);
    font-family: var(--font-body);
    font-size: 0.68rem;
    letter-spacing: 0.05em;
    text-transform: uppercase;
  }
</style>
