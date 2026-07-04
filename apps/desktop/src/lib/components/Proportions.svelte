<script lang="ts">
  import { formatUsd } from "$lib/format";

  interface Props {
    slices: { label: string; amount: number }[];
    total: number;
  }
  let { slices, total }: Props = $props();

  const COLORS: Record<string, string> = {
    Taxes: "var(--color-oxblood)",
    Investing: "var(--color-brass)",
    Goals: "var(--color-patina)",
    "Bills & essentials": "var(--color-copper)",
    Essentials: "var(--color-copper)",
    Spending: "var(--color-soot)",
    Leftover: "var(--color-dim)",
  };
  const color = (l: string) => COLORS[l] ?? "var(--color-etch)";
  const pct = (a: number) => (total > 0 ? (a / total) * 100 : 0);
</script>

<div class="prop">
  <div class="bar">
    {#each slices as s (s.label)}
      {#if s.amount > 0}
        <div class="seg" style="width:{pct(s.amount)}%; background:{color(s.label)}" title="{s.label}: {formatUsd(s.amount)}"></div>
      {/if}
    {/each}
  </div>
  <div class="legend">
    {#each slices as s (s.label)}
      {#if s.amount > 0}
        <span class="item"><span class="dot" style="background:{color(s.label)}"></span>{s.label} {Math.round(pct(s.amount))}%</span>
      {/if}
    {/each}
  </div>
</div>

<style>
  .prop {
    width: 100%;
  }
  .bar {
    display: flex;
    height: 16px;
    border-radius: 8px;
    overflow: hidden;
    border: 1px solid var(--color-etch);
    box-shadow: var(--bevel);
  }
  .seg {
    height: 100%;
  }
  .legend {
    display: flex;
    flex-wrap: wrap;
    gap: 0.75rem 1.1rem;
    justify-content: center;
    margin-top: 0.6rem;
    font-family: var(--font-body);
    font-size: 0.8rem;
    color: var(--color-soot);
  }
  .item {
    display: inline-flex;
    align-items: center;
    gap: 0.35rem;
  }
  .dot {
    width: 9px;
    height: 9px;
    border-radius: 2px;
    display: inline-block;
  }
</style>
