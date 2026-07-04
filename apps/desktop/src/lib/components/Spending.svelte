<script lang="ts">
  import { onMount } from "svelte";
  import { formatUsd } from "$lib/format";
  import { spending } from "$lib/stores/spending.svelte";

  const CATEGORIES = ["coffee", "dining", "groceries", "clothes", "entertainment", "transport", "subscriptions", "other"];
  const today = () => new Date().toISOString().slice(0, 10);
  let draft = $state({ category: "coffee", label: "", amount: 0, date: today() });

  onMount(() => {
    void spending.load();
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
</script>

<section class="spending">
  <header class="title">Variable spending</header>
  <p class="lede">Log discretionary purchases. This feeds your total expenses — so your savings pool and freedom date update with it.</p>

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
</style>
