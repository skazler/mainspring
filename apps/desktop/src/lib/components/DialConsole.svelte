<script lang="ts">
  import { Money } from "@mainspring/schema";
  import { bucketLabel } from "$lib/buckets";
  import { formatMoney } from "$lib/format";
  import { profile, setDialPct } from "$lib/stores/profile.svelte";
  import { view } from "$lib/stores/derived.svelte";
  import { session } from "$lib/stores/session.svelte";
  import Gauge from "./Gauge.svelte";
  import TakeHomeReadout from "./TakeHomeReadout.svelte";
  import FireSummary from "./FireSummary.svelte";

  const v = $derived(view.current);

  function allocFor(bucket: string, base: string) {
    return v.buckets.find((b) => b.bucket === bucket && b.base === base);
  }
</script>

<section class="console">
  <header class="title">
    <span>MAINSPRING</span>
    <button class="edit" onclick={() => (session.configured = false)}>Edit setup</button>
  </header>

  <div class="readouts">
    <TakeHomeReadout net={v.net} gross={v.gross} tax={v.tax.total} />
    <FireSummary fire={v.fire} savingsRate={v.savingsRate} />
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
</section>

<style>
  .console {
    max-width: 70rem;
    margin: 0 auto;
    padding: 2rem 1.5rem 4rem;
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
  .warn {
    margin-top: 1.5rem;
    text-align: center;
    color: var(--color-oxblood);
    font-family: var(--font-body);
  }
</style>
