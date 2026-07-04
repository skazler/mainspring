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
    /** Annualized recurring commitments — drawn as the "if invested instead" ghost line. */
    commitments?: Money;
  }
  let { currentBalance, annualContribution, realReturn, currentAge, targetRetireAge, coast, fi, commitments }: Props = $props();

  let host: HTMLDivElement;
  let width = $state(640);
  let chart: uPlot | null = null;

  const coastN = $derived(Number(coast.toString()));
  const fiN = $derived(Number(fi.toString()));
  const commitN = $derived(commitments ? Number(commitments.toString()) : 0);
  // Lifetime drag: the gap between the "bills invested instead" path and the real
  // path at the target retirement age — i.e. what your commitments cost you.
  let drag = $state(0);
  let dragAge = $state(0);

  async function build() {
    const { default: UPlot } = await import("uplot");
    chart?.destroy();

    const years = Math.max(targetRetireAge - currentAge + 8, 35);
    const projected = projectBalances({ currentBalance, annualContribution, realReturn, years }).map((m) => Number(m.toString()));
    const ys = [Number(currentBalance.toString()), ...projected];
    const ages = ys.map((_, i) => currentAge + i);
    const coastLine = ys.map(() => coastN);
    const fiLine = ys.map(() => fiN);

    // Counterfactual path: the same plan with recurring commitments invested
    // instead of spent. The gap is the lifetime cost of your bills.
    const hasBills = commitN > 0;
    const ghost = hasBills
      ? [
          Number(currentBalance.toString()),
          ...projectBalances({ currentBalance, annualContribution: annualContribution.add(commitments!), realReturn, years }).map((m) => Number(m.toString())),
        ]
      : ys.map(() => null);
    const at = Math.min(Math.max(targetRetireAge - currentAge, 0), ys.length - 1);
    drag = hasBills ? (ghost[at] as number) - ys[at] : 0;
    dragAge = currentAge + at;

    const data = [ages, ys, ghost, coastLine, fiLine] as uPlot.AlignedData;

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
        { label: "Bills invested", stroke: "#9aa356", width: 1, dash: [3, 3] },
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
    void commitN;
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
{#if commitN > 0 && drag > 0}
  <p class="drag">
    <span class="bi">▨ bills invested instead</span> — your recurring commitments cost you
    <strong>{formatUsd(drag)}</strong> of net worth by {dragAge}.
  </p>
{/if}

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
  .drag {
    text-align: center;
    font-family: var(--font-body);
    font-size: 0.8rem;
    color: var(--color-soot);
    margin: 0.5rem 0 0;
  }
  .drag .bi {
    color: var(--color-lime-rust);
  }
  .drag strong {
    font-family: var(--font-meter);
    color: var(--color-lime-rust);
  }
</style>
