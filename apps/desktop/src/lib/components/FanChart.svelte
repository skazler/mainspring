<script lang="ts">
  import "uplot/dist/uPlot.min.css";
  import type uPlot from "uplot";
  import type { Forecast } from "$lib/bridge/invoke";

  interface Props {
    forecast: Forecast;
    currentAge: number;
  }
  let { forecast, currentAge }: Props = $props();

  let host: HTMLDivElement;
  let width = $state(640);
  let chart: uPlot | null = null;

  async function build() {
    const { default: UPlot } = await import("uplot");
    chart?.destroy();

    const ages = forecast.years.map((y) => currentAge + y);
    const data = [ages, forecast.p10, forecast.p50, forecast.p90] as uPlot.AlignedData;

    const opts: uPlot.Options = {
      width,
      height: 300,
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
        { label: "p10", stroke: "rgba(201,162,75,0.35)", width: 1 },
        { label: "p50", stroke: "#c9a24b", width: 2 },
        { label: "p90", stroke: "rgba(201,162,75,0.35)", width: 1 },
      ],
      bands: [{ series: [3, 1], fill: "rgba(201,162,75,0.15)" }],
    };

    chart = new UPlot(opts, data, host);
  }

  $effect(() => {
    // re-run on forecast or width change
    void forecast;
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

<style>
  .wrap {
    width: 100%;
  }
  :global(.uplot) {
    font-family: var(--font-meter);
  }
</style>
