<script lang="ts">
  import "uplot/dist/uPlot.min.css";
  import type uPlot from "uplot";
  import { projectBalances } from "@mainspring/engine";
  import { Money } from "@mainspring/schema";
  import { formatUsd } from "$lib/format";

  interface Props {
    currentBalance: Money;
    annualContribution: Money;
    realReturn: string;
    currentAge: number;
    targetRetireAge: number;
    coast: Money;
    fi: Money;
  }
  let { currentBalance, annualContribution, realReturn, currentAge, targetRetireAge, coast, fi }: Props = $props();

  let host: HTMLDivElement;
  let width = $state(640);
  let chart: uPlot | null = null;

  const coastN = $derived(Number(coast.toString()));
  const fiN = $derived(Number(fi.toString()));

  async function build() {
    const { default: UPlot } = await import("uplot");
    chart?.destroy();

    const years = Math.max(targetRetireAge - currentAge + 8, 35);
    const projected = projectBalances({ currentBalance, annualContribution, realReturn, years }).map((m) => Number(m.toString()));
    const ys = [Number(currentBalance.toString()), ...projected];
    const ages = ys.map((_, i) => currentAge + i);
    const coastLine = ys.map(() => coastN);
    const fiLine = ys.map(() => fiN);
    const data = [ages, ys, coastLine, fiLine] as uPlot.AlignedData;

    const opts: uPlot.Options = {
      width,
      height: 260,
      scales: { x: { time: false } },
      legend: { show: false },
      axes: [
        { stroke: "#a89a82", grid: { stroke: "#3a3023" }, ticks: { stroke: "#3a3023" } },
        {
          stroke: "#a89a82",
          grid: { stroke: "#3a3023" },
          ticks: { stroke: "#3a3023" },
          values: (_u, splits) => splits.map((v) => `$${Math.round(v / 1000)}k`),
        },
      ],
      series: [
        { label: "Age" },
        { label: "Net worth", stroke: "#c9a24b", width: 2, fill: "rgba(201,162,75,0.10)" },
        { label: "Coast", stroke: "#4a9e8f", width: 1, dash: [6, 4] },
        { label: "FI", stroke: "#e8c874", width: 1, dash: [6, 4] },
      ],
    };
    chart = new UPlot(opts, data, host);
  }

  $effect(() => {
    void currentBalance;
    void annualContribution;
    void realReturn;
    void coastN;
    void fiN;
    void width;
    if (host) void build();
    return () => {
      chart?.destroy();
      chart = null;
    };
  });
</script>

<div class="wrap" bind:clientWidth={width}>
  <div bind:this={host}></div>
</div>
<div class="legend">
  <span class="nw">■ projected net worth</span>
  <span class="co">▨ coast · {formatUsd(coastN)}</span>
  <span class="fi">▨ FI · {formatUsd(fiN)}</span>
</div>

<style>
  .wrap {
    width: 100%;
  }
  :global(.uplot) {
    font-family: var(--font-meter);
  }
  .legend {
    display: flex;
    gap: 1.25rem;
    justify-content: center;
    font-family: var(--font-body);
    font-size: 0.8rem;
    margin-top: 0.4rem;
  }
  .nw {
    color: var(--color-brass);
  }
  .co {
    color: var(--color-patina);
  }
  .fi {
    color: var(--color-gilt);
  }
</style>
