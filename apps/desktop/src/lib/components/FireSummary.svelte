<script lang="ts">
  import type { FireMetrics } from "@mainspring/engine";
  import { formatMoney, formatPct } from "$lib/format";

  interface Props {
    fire: FireMetrics;
    savingsRate: string;
  }
  let { fire, savingsRate }: Props = $props();
</script>

<div class="readout">
  <div class="big">
    <span class="k">Freedom</span>
    <span class="v" class:reached={fire.alreadyFI}>
      {#if fire.alreadyFI}
        Reached
      {:else if fire.yearsToFI !== null}
        age {fire.fiAge} · {fire.yearsToFI} yrs
      {:else}
        out of reach
      {/if}
    </span>
  </div>
  <div class="row"><span class="k">FI number</span><span class="v">{formatMoney(fire.fiNumber)}</span></div>
  <div class="row"><span class="k">Savings rate</span><span class="v">{formatPct(savingsRate)}</span></div>
  <div class="row"><span class="k">Coast number</span><span class="v">{formatMoney(fire.coastNumber)}</span></div>
</div>

<style>
  .readout {
    background: var(--color-panel);
    border: 1px solid var(--color-etch);
    border-radius: 10px;
    padding: 1.1rem 1.3rem;
    min-width: 15rem;
  }
  .big {
    display: flex;
    flex-direction: column;
    margin-bottom: 0.7rem;
  }
  .big .v {
    font-family: var(--font-meter);
    font-size: 2rem;
    color: var(--color-gilt);
    font-variant-numeric: tabular-nums;
  }
  .big .v.reached {
    color: var(--color-lime-rust);
  }
  .k {
    font-family: var(--font-body);
    color: var(--color-soot);
    font-size: 0.78rem;
    letter-spacing: 0.05em;
  }
  .row {
    display: flex;
    justify-content: space-between;
    font-family: var(--font-meter);
    font-variant-numeric: tabular-nums;
    color: var(--color-parchment);
    padding: 0.15rem 0;
  }
</style>
