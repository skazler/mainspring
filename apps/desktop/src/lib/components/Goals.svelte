<script lang="ts">
  import { onMount } from "svelte";
  import { formatUsd } from "$lib/format";
  import { goals } from "$lib/stores/goals.svelte";

  let draft = $state({ name: "", target: 0, saved: 0, monthly: 0, date: "" });
  let contribInput = $state<Record<string, number>>({});

  onMount(() => {
    void goals.load();
  });

  function add(e: Event) {
    e.preventDefault();
    if (!draft.name.trim() || draft.target <= 0) return;
    goals.save({
      id: crypto.randomUUID(),
      name: draft.name.trim(),
      targetAmount: String(draft.target),
      savedAmount: String(draft.saved || 0),
      targetDate: draft.date || null,
      monthlyContribution: draft.monthly > 0 ? String(draft.monthly) : null,
    });
    draft = { name: "", target: 0, saved: 0, monthly: 0, date: "" };
  }

  function etaLabel(months: number | null): string {
    if (months === null) return "set a monthly amount for an ETA";
    if (months === 0) return "reached 🎉";
    if (months < 12) return `~${months} mo`;
    const y = Math.floor(months / 12);
    const m = months % 12;
    return m ? `~${y}y ${m}mo` : `~${y}y`;
  }
</script>

<section class="goals">
  <header class="title">Savings goals</header>
  <p class="lede">Sinking funds for anything — a house down payment, a trip, a new laptop. Track progress and see when you'll get there.</p>

  <form class="add" onsubmit={add}>
    <input class="nm" placeholder="Goal (e.g. house down payment)" bind:value={draft.name} />
    <input type="number" min="0" step="any" placeholder="Target $" bind:value={draft.target} />
    <input type="number" min="0" step="any" placeholder="Saved so far $" bind:value={draft.saved} />
    <input type="number" min="0" step="any" placeholder="Per month $" bind:value={draft.monthly} />
    <input type="date" bind:value={draft.date} title="Optional deadline" />
    <button type="submit">Add goal</button>
  </form>

  {#if goals.error}<p class="warn">{goals.error}</p>{/if}

  {#if goals.rows.length === 0}
    <p class="empty">No goals yet — add one above.</p>
  {:else}
    <div class="cards">
      {#each goals.rows as g (g.id)}
        {@const s = goals.status(g)}
        {@const pct = Math.min(100, Math.round(Number(s.progress) * 100))}
        <div class="card" class:done={s.complete}>
          <div class="head">
            <span class="name">{g.name}</span>
            <button class="del" onclick={() => goals.remove(g.id)}>✕</button>
          </div>
          <div class="bar"><div class="fill" style="width:{pct}%"></div></div>
          <div class="nums">
            <span class="mono">{formatUsd(Number(g.savedAmount))} / {formatUsd(Number(g.targetAmount))}</span>
            <span class="pct">{pct}%</span>
          </div>
          <div class="meta">
            <span>{etaLabel(s.monthsToGoal)}</span>
            {#if s.requiredMonthly}<span class="req">need {formatUsd(Number(s.requiredMonthly.toString()))}/mo{#if g.targetDate} by {g.targetDate}{/if}</span>{/if}
          </div>
          {#if !s.complete}
            <div class="contrib">
              <input type="number" min="0" step="any" placeholder="Add $" bind:value={contribInput[g.id]} />
              <button
                onclick={() => {
                  goals.contribute(g.id, contribInput[g.id] ?? 0);
                  contribInput[g.id] = 0;
                }}
              >Contribute</button>
            </div>
          {/if}
        </div>
      {/each}
    </div>
  {/if}
</section>

<style>
  .goals {
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
    margin-bottom: 1.5rem;
  }
  input {
    background: var(--color-coal);
    border: 1px solid var(--color-etch);
    border-radius: 6px;
    color: var(--color-parchment);
    font-family: var(--font-meter);
    padding: 0.45rem 0.6rem;
  }
  .nm {
    width: 14rem;
  }
  .add button,
  .contrib button {
    background: var(--color-brass);
    color: var(--color-coal);
    border: none;
    border-radius: 6px;
    padding: 0.5rem 1.1rem;
    cursor: pointer;
    font-family: var(--font-body);
  }
  .cards {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(18rem, 1fr));
    gap: 1.25rem;
  }
  .card {
    border: 1px solid var(--color-etch);
    border-radius: 10px;
    background: var(--color-panel);
    box-shadow: var(--bevel);
    padding: 1rem 1.1rem;
  }
  .card.done {
    border-color: var(--color-lime-rust);
  }
  .head {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 0.6rem;
  }
  .name {
    font-family: var(--font-display);
    color: var(--color-gilt);
    letter-spacing: 0.04em;
  }
  .del {
    background: transparent;
    border: none;
    color: var(--color-oxblood);
    cursor: pointer;
  }
  .bar {
    height: 8px;
    background: var(--color-coal);
    border-radius: 4px;
    overflow: hidden;
    border: 1px solid var(--color-etch);
  }
  .fill {
    height: 100%;
    background: var(--color-brass);
  }
  .card.done .fill {
    background: var(--color-lime-rust);
  }
  .nums {
    display: flex;
    justify-content: space-between;
    margin-top: 0.5rem;
    font-family: var(--font-meter);
    font-variant-numeric: tabular-nums;
    color: var(--color-parchment);
  }
  .pct {
    color: var(--color-brass);
  }
  .meta {
    display: flex;
    justify-content: space-between;
    flex-wrap: wrap;
    gap: 0.3rem;
    margin-top: 0.4rem;
    font-family: var(--font-body);
    color: var(--color-soot);
    font-size: 0.82rem;
  }
  .req {
    color: var(--color-copper);
  }
  .contrib {
    display: flex;
    gap: 0.5rem;
    margin-top: 0.75rem;
  }
  .contrib input {
    flex: 1;
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
    margin-bottom: 1rem;
  }
</style>
