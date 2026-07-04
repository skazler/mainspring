<script lang="ts">
  import { formatUsd } from "$lib/format";

  interface Props {
    slices: { label: string; amount: number }[];
    /** Optional label under the center total (e.g. "per year"). */
    unit?: string;
  }
  let { slices, unit }: Props = $props();

  // Steampunk palette, cycled across categories.
  const PALETTE = [
    "var(--color-brass)",
    "var(--color-patina)",
    "var(--color-copper)",
    "var(--color-lime-rust)",
    "var(--color-oxblood)",
    "var(--color-gilt)",
    "var(--color-soot)",
    "var(--color-iron)",
  ];

  const R = 60;
  const C = 2 * Math.PI * R;

  const shown = $derived(slices.filter((s) => s.amount > 0).sort((a, b) => b.amount - a.amount));
  const total = $derived(shown.reduce((sum, s) => sum + s.amount, 0));
  // Precompute each arc's length and starting offset around the ring.
  const arcs = $derived(
    (() => {
      let acc = 0;
      return shown.map((s, i) => {
        const frac = total > 0 ? s.amount / total : 0;
        const arc = { ...s, color: PALETTE[i % PALETTE.length], len: frac * C, offset: acc, pct: frac * 100 };
        acc += frac * C;
        return arc;
      });
    })(),
  );
</script>

{#if shown.length > 0}
  <div class="donut">
    <svg viewBox="0 0 160 160" class="ring" role="img" aria-label="Category breakdown">
      <g transform="rotate(-90 80 80)">
        {#each arcs as a (a.label)}
          <circle
            cx="80"
            cy="80"
            r={R}
            fill="none"
            stroke={a.color}
            stroke-width="20"
            stroke-dasharray="{a.len} {C - a.len}"
            stroke-dashoffset={-a.offset}
          />
        {/each}
      </g>
      <text x="80" y="76" class="total">{formatUsd(total)}</text>
      {#if unit}<text x="80" y="94" class="unit">{unit}</text>{/if}
    </svg>
    <ul class="legend">
      {#each arcs as a (a.label)}
        <li>
          <span class="dot" style="background:{a.color}"></span>
          <span class="lbl">{a.label}</span>
          <span class="val">{formatUsd(a.amount)}</span>
          <span class="pct">{Math.round(a.pct)}%</span>
        </li>
      {/each}
    </ul>
  </div>
{:else}
  <p class="empty">Nothing to compare yet.</p>
{/if}

<style>
  .donut {
    display: flex;
    align-items: center;
    gap: 1.5rem;
    flex-wrap: wrap;
    justify-content: center;
  }
  .ring {
    width: 160px;
    height: 160px;
    flex-shrink: 0;
  }
  .total {
    text-anchor: middle;
    font-family: var(--font-meter);
    fill: var(--color-parchment);
    font-size: 15px;
  }
  .unit {
    text-anchor: middle;
    font-family: var(--font-body);
    fill: var(--color-dim);
    font-size: 8px;
    letter-spacing: 0.1em;
    text-transform: uppercase;
  }
  .legend {
    list-style: none;
    margin: 0;
    padding: 0;
    min-width: 15rem;
  }
  .legend li {
    display: grid;
    grid-template-columns: auto 1fr auto auto;
    align-items: center;
    gap: 0.5rem;
    padding: 0.28rem 0;
    border-bottom: 1px solid var(--color-etch);
    font-family: var(--font-body);
    font-size: 0.85rem;
  }
  .dot {
    width: 10px;
    height: 10px;
    border-radius: 2px;
  }
  .lbl {
    color: var(--color-parchment);
    text-transform: capitalize;
  }
  .val {
    font-family: var(--font-meter);
    color: var(--color-copper);
    text-align: right;
  }
  .pct {
    font-family: var(--font-meter);
    color: var(--color-soot);
    text-align: right;
    min-width: 2.5rem;
  }
  .empty {
    text-align: center;
    color: var(--color-dim);
    font-family: var(--font-body);
  }
</style>
