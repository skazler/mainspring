<script lang="ts">
  import type { Money } from "@mainspring/schema";
  import { formatMoney } from "$lib/format";

  interface Props {
    /** What reaches the bank: gross − tax − payroll contributions − premiums. */
    cashTakeHome: Money;
    gross: Money;
    tax: Money;
    /** 401(k)/Roth 401(k)/HSA withheld from the paycheck. */
    payrollContributions: Money;
    /** Health/dental/vision withheld from the paycheck. */
    benefitPremiums: Money;
  }
  let { cashTakeHome, gross, tax, payrollContributions, benefitPremiums }: Props = $props();
</script>

<div class="readout">
  <div class="big">
    <span class="k">Take-home</span>
    <span class="v">{formatMoney(cashTakeHome)}</span>
    <span class="hint">what lands in your bank account</span>
  </div>
  <div class="row"><span class="k">Gross</span><span class="v">{formatMoney(gross)}</span></div>
  <div class="row out"><span class="k">Tax</span><span class="v">−{formatMoney(tax)}</span></div>
  {#if !payrollContributions.isZero()}
    <div class="row out"><span class="k">Contributions</span><span class="v">−{formatMoney(payrollContributions)}</span></div>
  {/if}
  {#if !benefitPremiums.isZero()}
    <div class="row out"><span class="k">Benefits</span><span class="v">−{formatMoney(benefitPremiums)}</span></div>
  {/if}
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
  .hint {
    font-family: var(--font-body);
    color: var(--color-soot);
    font-size: 0.68rem;
    margin-top: 0.1rem;
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
