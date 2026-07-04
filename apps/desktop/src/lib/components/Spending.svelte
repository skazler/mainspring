<script lang="ts">
  import { onMount } from "svelte";
  import { cadenceAbbrev, formatUsd } from "$lib/format";
  import { spending } from "$lib/stores/spending.svelte";
  import { recurring } from "$lib/stores/recurring.svelte";
  import Donut from "./Donut.svelte";

  const CATEGORIES = ["coffee", "dining", "groceries", "clothes", "entertainment", "transport", "subscriptions", "other"];
  const BILL_CATEGORIES = ["software dev", "insurance", "car", "housing", "utilities", "phone", "api", "subscription", "loan", "other"];
  const CADENCES = ["weekly", "biweekly", "monthly", "quarterly", "annual"] as const;
  const today = () => new Date().toISOString().slice(0, 10);
  let draft = $state({ category: "coffee", label: "", amount: 0, date: today() });
  let bill = $state<{ label: string; category: string; amount: number; cadence: (typeof CADENCES)[number] }>({
    label: "",
    category: "insurance",
    amount: 0,
    cadence: "monthly",
  });

  onMount(() => {
    void spending.load();
    void recurring.load();
  });

  async function add(e: Event) {
    e.preventDefault();
    if (!draft.category.trim() || draft.amount <= 0) return;
    await spending.add({
      id: crypto.randomUUID(),
      category: draft.category.trim().toLowerCase(),
      label: draft.label.trim() || null,
      amount: String(draft.amount),
      spentAt: draft.date,
    });
    draft = { category: draft.category, label: "", amount: 0, date: today() };
  }

  function addBill(e: Event) {
    e.preventDefault();
    if (!bill.label.trim() || bill.amount <= 0) return;
    recurring.save({
      id: crypto.randomUUID(),
      label: bill.label.trim(),
      category: bill.category.trim().toLowerCase(),
      amount: String(bill.amount),
      cadence: bill.cadence,
      kind: "bill",
      active: true,
    });
    bill = { label: "", category: bill.category, amount: 0, cadence: bill.cadence };
  }
</script>

<section class="spending">
  <header class="title">Outflows</header>
  <p class="lede">Everything leaving your account — fixed commitments and day-to-day spending. Both feed your total expenses, so your savings pool and freedom date move with them.</p>

  <div class="block">
    <h2 class="section">Recurring commitments</h2>
    <p class="hint">Insurance, car payment, subscriptions, API costs — anything charged on a schedule.</p>

    <form class="add" onsubmit={addBill}>
      <input class="lbl" placeholder="What is it? (e.g. Car insurance)" bind:value={bill.label} />
      <input class="cat" list="bills" placeholder="Category" bind:value={bill.category} />
      <datalist id="bills">{#each BILL_CATEGORIES as c (c)}<option value={c}></option>{/each}</datalist>
      <input type="number" min="0" step="any" placeholder="Amount" bind:value={bill.amount} />
      <select bind:value={bill.cadence}>
        {#each CADENCES as c (c)}<option value={c}>{c}</option>{/each}
      </select>
      <button type="submit">Add</button>
    </form>

    <div class="summary">
      <span>Committed: <strong>{formatUsd(Number(recurring.billsAnnual.toString()))}</strong>/yr</span>
    </div>

    {#if recurring.error}<p class="warn">{recurring.error}</p>{/if}

    {#if recurring.bills.length > 0}
      <table class="bills">
        <tbody>
          {#each recurring.bills as r (r.id)}
            <tr class:paused={!r.active}>
              <td class="cap">{r.label}<span class="dim"> · {r.category}</span></td>
              <td class="mono">{formatUsd(Number(r.amount))}<span class="dim">/{cadenceAbbrev(r.cadence)}</span></td>
              <td class="mono">{formatUsd(Number(recurring.annual(r).toString()))}<span class="dim">/yr</span></td>
              <td><button class="link" onclick={() => recurring.toggle(r.id)}>{r.active ? "pause" : "resume"}</button></td>
              <td><button class="del" onclick={() => recurring.remove(r.id)}>✕</button></td>
            </tr>
          {/each}
        </tbody>
      </table>

      {#if recurring.billsByCategory.length > 1}
        <h3 class="compare-title">By category</h3>
        <Donut
          slices={recurring.billsByCategory.map((c) => ({ label: c.category, amount: Number(c.annual.toString()) }))}
          unit="per year"
        />
      {/if}
    {:else}
      <p class="empty">No commitments yet — add a bill above.</p>
    {/if}
  </div>

  <h2 class="section">Variable spending</h2>
  <p class="hint">Discretionary purchases — logged and annualized from the months they span.</p>

  <form class="add" onsubmit={add}>
    <input class="cat" list="cats" placeholder="Category" bind:value={draft.category} />
    <datalist id="cats">{#each CATEGORIES as c (c)}<option value={c}></option>{/each}</datalist>
    <input class="lbl" placeholder="Note (optional)" bind:value={draft.label} />
    <input type="number" min="0" step="any" placeholder="Amount" bind:value={draft.amount} />
    <input type="date" bind:value={draft.date} />
    <button type="submit">Log</button>
  </form>

  <div class="summary">
    <span>Annualized: <strong>{formatUsd(Number(spending.annualized.toString()))}</strong>/yr</span>
  </div>

  {#if spending.error}<p class="warn">{spending.error}</p>{/if}

  {#if spending.byCategory.length > 0}
    <div class="grid">
      <div class="col">
        <h3>By category</h3>
        <table>
          <tbody>
            {#each spending.byCategory as c (c.category)}
              <tr><td class="cap">{c.category}</td><td class="mono">{formatUsd(Number(c.total.toString()))}</td></tr>
            {/each}
          </tbody>
        </table>
      </div>
      <div class="col">
        <h3>Recent</h3>
        <table>
          <tbody>
            {#each spending.rows.slice(0, 20) as r (r.id)}
              <tr>
                <td class="mono date">{r.spentAt}</td>
                <td class="cap">{r.category}{#if r.label} · <span class="dim">{r.label}</span>{/if}</td>
                <td class="mono">{formatUsd(Number(r.amount))}</td>
                <td><button class="del" onclick={() => spending.remove(r.id)}>✕</button></td>
              </tr>
            {/each}
          </tbody>
        </table>
      </div>
    </div>
  {:else}
    <p class="empty">Nothing logged yet — add your first purchase above.</p>
  {/if}
</section>

<style>
  .spending {
    max-width: 60rem;
    margin: 0 auto;
    padding: 2rem 1.5rem 4rem;
  }
  .title {
    font-family: var(--font-display);
    letter-spacing: 0.2em;
    color: var(--color-brass);
    font-size: 1.3rem;
    text-align: center;
    margin-bottom: 0.5rem;
  }
  .lede {
    text-align: center;
    color: var(--color-soot);
    font-family: var(--font-body);
    margin-bottom: 1.4rem;
  }
  .add {
    display: flex;
    gap: 0.5rem;
    flex-wrap: wrap;
    justify-content: center;
    margin-bottom: 1rem;
  }
  input {
    background: var(--color-coal);
    border: 1px solid var(--color-etch);
    border-radius: 6px;
    color: var(--color-parchment);
    font-family: var(--font-meter);
    padding: 0.45rem 0.6rem;
  }
  .cat {
    width: 8rem;
    text-transform: lowercase;
  }
  .lbl {
    width: 10rem;
  }
  button[type="submit"] {
    background: var(--color-brass);
    color: var(--color-coal);
    border: none;
    border-radius: 6px;
    padding: 0.5rem 1.1rem;
    cursor: pointer;
    font-family: var(--font-body);
  }
  .summary {
    text-align: center;
    font-family: var(--font-body);
    color: var(--color-parchment);
    margin-bottom: 1.5rem;
  }
  .summary strong {
    font-family: var(--font-meter);
    color: var(--color-copper);
    font-size: 1.15rem;
  }
  .grid {
    display: grid;
    grid-template-columns: 1fr 1.4fr;
    gap: 2rem;
  }
  h3 {
    font-family: var(--font-display);
    color: var(--color-gilt);
    letter-spacing: 0.08em;
    margin: 0 0 0.4rem;
  }
  table {
    width: 100%;
    border-collapse: collapse;
    font-family: var(--font-meter);
  }
  td {
    text-align: right;
    padding: 0.4rem 0.5rem;
    border-bottom: 1px solid var(--color-etch);
    color: var(--color-parchment);
  }
  td:first-child,
  .cap {
    text-align: left;
  }
  .cap {
    text-transform: capitalize;
    color: var(--color-parchment);
  }
  .date {
    color: var(--color-soot);
    font-size: 0.85rem;
  }
  .dim {
    color: var(--color-dim);
    text-transform: none;
  }
  .del {
    background: transparent;
    border: none;
    color: var(--color-oxblood);
    cursor: pointer;
  }
  .empty {
    text-align: center;
    color: var(--color-dim);
    font-family: var(--font-body);
  }
  .warn {
    text-align: center;
    color: var(--color-oxblood);
    font-family: var(--font-body);
    font-size: 0.85rem;
  }
  .block {
    border: 1px solid var(--color-etch);
    border-radius: 10px;
    background: var(--color-panel);
    box-shadow: var(--bevel);
    padding: 1.2rem 1.4rem 1.5rem;
    margin-bottom: 2.5rem;
  }
  .section {
    font-family: var(--font-display);
    color: var(--color-gilt);
    letter-spacing: 0.1em;
    font-size: 1rem;
    text-align: center;
    margin: 0 0 0.2rem;
  }
  .hint {
    text-align: center;
    color: var(--color-dim);
    font-family: var(--font-body);
    font-size: 0.85rem;
    margin: 0 0 1rem;
  }
  select {
    background: var(--color-coal);
    border: 1px solid var(--color-etch);
    border-radius: 6px;
    color: var(--color-parchment);
    font-family: var(--font-body);
    padding: 0.45rem 0.6rem;
    text-transform: capitalize;
  }
  .bills {
    width: 100%;
    border-collapse: collapse;
    font-family: var(--font-meter);
  }
  .bills td {
    text-align: right;
  }
  .bills td:first-child {
    text-align: left;
  }
  .bills .paused {
    opacity: 0.45;
  }
  .link {
    background: transparent;
    border: none;
    color: var(--color-soot);
    cursor: pointer;
    font-family: var(--font-body);
    font-size: 0.85rem;
  }
  .link:hover {
    color: var(--color-gilt);
  }
  .compare-title {
    text-align: center;
    margin: 1.6rem 0 1rem;
  }
</style>
