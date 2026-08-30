<script lang="ts">
  import { formatUsd } from "$lib/format";

  interface Props {
    /** Parts of one breakdown line, in the order they're listed below it. */
    slices: { name: string; amount: number }[];
    /** Name → color, shared with the detail rows so the two read as one thing. */
    colors: Record<string, string>;
  }
  let { slices, colors }: Props = $props();

  const total = $derived(slices.reduce((s, d) => s + d.amount, 0));
  const pct = (a: number) => (total > 0 ? (a / total) * 100 : 0);
</script>

<div class="subbar" role="presentation">
  {#each slices as d (d.name)}
    {#if d.amount > 0}
      <div
        class="seg"
        style="width:{pct(d.amount)}%; background:{colors[d.name] ?? 'var(--color-etch)'}"
        title="{d.name}: {formatUsd(d.amount / 12)}/mo · {Math.round(pct(d.amount))}%"
      ></div>
    {/if}
  {/each}
</div>

<style>
  .subbar {
    display: flex;
    height: 8px;
    border-radius: 4px;
    overflow: hidden;
    border: 1px solid var(--color-etch);
  }
  .seg {
    height: 100%;
  }
</style>
