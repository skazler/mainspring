<script lang="ts">
  import { clamp01, pctToAngle, pointerToPct, tickPoint } from "$lib/gauge-math";

  interface Props {
    label: string;
    pct: number;
    amount: string;
    clamped?: boolean;
    outflow?: boolean;
    active?: boolean;
    onChange?: (pct: number) => void;
  }
  let { label, pct, amount, clamped = false, outflow = false, active = false, onChange }: Props = $props();

  let svgEl: SVGSVGElement | null = $state(null);
  let dragging = $state(false);

  const angle = $derived(pctToAngle(pct));
  const arcPath = $derived(buildArc(pct));
  const ticks = Array.from({ length: 11 }, (_, i) => i / 10);

  function buildArc(p: number): string {
    const c = clamp01(p);
    if (c <= 0) return "";
    const start = tickPoint(0, 50, 50, 40);
    const end = tickPoint(c, 50, 50, 40);
    const largeArc = c * 270 > 180 ? 1 : 0;
    return `M ${start.x} ${start.y} A 40 40 0 ${largeArc} 1 ${end.x} ${end.y}`;
  }

  function emit(clientX: number, clientY: number) {
    if (!svgEl) return;
    const r = svgEl.getBoundingClientRect();
    onChange?.(pointerToPct(r.left + r.width / 2, r.top + r.height / 2, clientX, clientY));
  }
  function onpointerdown(e: PointerEvent) {
    dragging = true;
    (e.currentTarget as Element).setPointerCapture(e.pointerId);
    emit(e.clientX, e.clientY);
  }
  function onpointermove(e: PointerEvent) {
    if (dragging) emit(e.clientX, e.clientY);
  }
  function onpointerup(e: PointerEvent) {
    dragging = false;
    (e.currentTarget as Element).releasePointerCapture(e.pointerId);
  }
  function onkeydown(e: KeyboardEvent) {
    const step = e.shiftKey ? 0.1 : 0.01;
    if (e.key === "ArrowUp" || e.key === "ArrowRight") {
      onChange?.(clamp01(pct + step));
      e.preventDefault();
    } else if (e.key === "ArrowDown" || e.key === "ArrowLeft") {
      onChange?.(clamp01(pct - step));
      e.preventDefault();
    }
  }
</script>

<div class="gauge" class:active class:clamped class:outflow>
  <svg
    bind:this={svgEl}
    viewBox="0 0 100 100"
    class="face"
    role="slider"
    aria-label={label}
    aria-valuemin="0"
    aria-valuemax="100"
    aria-valuenow={Math.round(pct * 100)}
    tabindex="0"
    {onpointerdown}
    {onpointermove}
    {onpointerup}
    {onkeydown}
  >
    <circle cx="50" cy="50" r="47" class="housing" />
    <circle cx="50" cy="50" r="41" class="dial" />
    {#if arcPath}<path d={arcPath} class="arc" />{/if}
    {#each ticks as t (t)}
      {@const inner = tickPoint(t, 50, 50, 34)}
      {@const outer = tickPoint(t, 50, 50, 40)}
      <line x1={inner.x} y1={inner.y} x2={outer.x} y2={outer.y} class="tick" />
    {/each}
    <g class="needle-group" transform="rotate({angle} 50 50)">
      <line x1="50" y1="50" x2="50" y2="15" class="needle" />
    </g>
    <circle cx="50" cy="50" r="4" class="hub" />
  </svg>
  <div class="meta">
    <div class="label">{label}</div>
    <div class="amount">{amount}</div>
  </div>
</div>

<style>
  .gauge {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.45rem;
  }
  svg.face {
    width: 140px;
    height: 140px;
    cursor: grab;
    touch-action: none;
    outline: none;
  }
  svg.face:active {
    cursor: grabbing;
  }
  .housing {
    fill: var(--color-panel);
    stroke: var(--color-etch);
    stroke-width: 2;
  }
  svg.face:focus-visible .housing {
    stroke: var(--color-gilt);
  }
  .dial {
    fill: var(--color-coal);
  }
  .arc {
    fill: none;
    stroke: var(--color-brass);
    stroke-width: 4;
    stroke-linecap: round;
    opacity: 0.92;
  }
  .tick {
    stroke: var(--color-soot);
    stroke-width: 1;
  }
  .needle {
    stroke: var(--color-brass);
    stroke-width: 2.5;
    stroke-linecap: round;
  }
  .needle-group {
    transition: transform 170ms cubic-bezier(0.2, 0.9, 0.3, 1.2);
  }
  .hub {
    fill: var(--color-gilt);
  }
  .label {
    font-family: var(--font-body);
    color: var(--color-soot);
    font-size: 0.8rem;
    letter-spacing: 0.04em;
    text-align: center;
  }
  .amount {
    font-family: var(--font-meter);
    color: var(--color-parchment);
    font-variant-numeric: tabular-nums;
    font-size: 1rem;
    text-align: center;
  }
  .active .housing,
  .active .needle,
  .active .arc {
    stroke: var(--color-gilt);
  }
  .clamped .arc {
    stroke: var(--color-patina);
  }
  .clamped .label {
    color: var(--color-patina);
  }
  .outflow .arc,
  .outflow .needle {
    stroke: var(--color-oxblood);
  }
</style>
