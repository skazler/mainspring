<script lang="ts">
  import type { Money } from "@mainspring/schema";
  import { formatMoney } from "$lib/format";

  interface Props {
    net: Money;
    gross: Money;
    tax: Money;
  }
  let { net, gross, tax }: Props = $props();
</script>

<div class="readout">
  <div class="big">
    <span class="k">Take-home</span>
    <span class="v">{formatMoney(net)}</span>
  </div>
  <div class="row"><span class="k">Gross</span><span class="v">{formatMoney(gross)}</span></div>
  <div class="row out"><span class="k">Tax</span><span class="v">−{formatMoney(tax)}</span></div>
</div>

<style>
  .readout {
    background: var(--color-panel);
    border: 1px solid var(--color-etch);
    border-radius: 10px;
    padding: 1.1rem 1.3rem;
    min-width: 15rem;
    box-shadow: var(--bevel);
  }
  .big {
    display: flex;
    flex-direction: column;
    margin-bottom: 0.7rem;
  }
  .big .v {
    font-family: var(--font-meter);
    font-size: 2rem;
    color: var(--color-brass);
    font-variant-numeric: tabular-nums;
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
  .row.out .v {
    color: var(--color-oxblood);
  }
</style>
