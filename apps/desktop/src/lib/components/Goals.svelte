<script lang="ts">
  import { onMount } from "svelte";
  import { formatUsd } from "$lib/format";
  import { goals } from "$lib/stores/goals.svelte";
  import { view } from "$lib/stores/derived.svelte";
  import { hints } from "$lib/stores/hints.svelte";
  import type { GoalRow } from "$lib/db";
  import ConfirmButton from "./ConfirmButton.svelte";

  const CADENCES = ["weekly", "biweekly", "monthly", "quarterly", "annual"] as const;
  let draft = $state<{ name: string; target: number; saved: number; amount: number; cadence: (typeof CADENCES)[number]; date: string }>({
    name: "",
    target: 0,
    saved: 0,
    amount: 0,
    cadence: "monthly",
    date: "",
  });
  let contribInput = $state<Record<string, number>>({});

  // Several goals can be funded at once, so the combined claim is worth stating
  // outright — one goal at a time made it self-evident, a handful doesn't.
  const committedMo = $derived(goals.activeGoals.reduce((sum, g) => sum + Number(goals.annual(g).toString()) / 12, 0));
  // Contributions aren't capped (a goal you committed to is shown as committed),
  // so the plan can be pushed under water. Say so here rather than leaving the
  // negative budget to be discovered over in Outflows.
  const allowanceMo = $derived(Number(view.current.discretionaryAllowance.toString()) / 12);

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
      contribution: draft.amount > 0 ? String(draft.amount) : null,
      cadence: draft.cadence,
      sortOrder: goals.nextOrder,
      active: true,
    });
    draft = { name: "", target: 0, saved: 0, amount: 0, cadence: draft.cadence, date: "" };
  }

  function setAmount(g: GoalRow, value: string): void {
    goals.save({ ...g, contribution: value && Number(value) > 0 ? String(value) : null });
  }
  function setCadence(g: GoalRow, cadence: string): void {
    goals.save({ ...g, cadence: cadence as GoalRow["cadence"] });
  }

  // Rename in place: click the name to edit, Enter or blur commits, Escape reverts.
  // A blank name is rejected rather than saved — a goal with no label is unusable
  // in the checklist, and the drill-down renders it by name.
  let editingId = $state<string | null>(null);
  let editName = $state("");

  function startRename(g: GoalRow): void {
    editingId = g.id;
    editName = g.name;
  }
  function commitRename(g: GoalRow): void {
    if (editingId !== g.id) return;
    const name = editName.trim();
    if (name && name !== g.name) goals.save({ ...g, name });
    editingId = null;
  }
  function renameKeys(e: KeyboardEvent, g: GoalRow): void {
    if (e.key === "Enter") {
      e.preventDefault();
      commitRename(g);
    } else if (e.key === "Escape") {
      e.preventDefault();
      editingId = null;
    }
  }

  function etaLabel(months: number | null): string {
    if (months === null) return "set a contribution for an ETA";
    if (months === 0) return "reached 🎉";
    if (months < 12) return `~${months} mo`;
    const y = Math.floor(months / 12);
    const m = months % 12;
    return m ? `~${y}y ${m}mo` : `~${y}y`;
  }
</script>

<section class="goals">
  <header class="title">Savings goals</header>
  {#if hints.show}
    <p class="lede">Sinking funds you can run <strong>side by side</strong>. Click a goal's badge to switch its funding on or off — every <strong>active</strong> goal claims its contribution from your plan at once, a <strong>paused</strong> one keeps its progress and claims nothing. Reorder with ▲▼.</p>
  {/if}

  <form class="add" onsubmit={add}>
    <input class="nm" placeholder="Goal (e.g. house down payment)" bind:value={draft.name} />
    <input type="number" min="0" step="any" placeholder="Target $" bind:value={draft.target} />
    <input type="number" min="0" step="any" placeholder="Saved so far $" bind:value={draft.saved} />
    <input type="number" min="0" step="any" placeholder="Contribute $" bind:value={draft.amount} />
    <select bind:value={draft.cadence} title="How often you contribute">
      {#each CADENCES as c (c)}<option value={c}>{c}</option>{/each}
    </select>
    <input type="date" bind:value={draft.date} title="Optional deadline" />
    <button type="submit">Add goal</button>
  </form>

  {#if goals.activeGoals.length > 0}
    <p class="committed" class:over={allowanceMo < 0}>
      Funding {goals.activeGoals.length} goal{goals.activeGoals.length === 1 ? "" : "s"} ·
      <strong class="mono">{formatUsd(committedMo)}/mo</strong> committed{#if allowanceMo < 0} — {formatUsd(-allowanceMo)}/mo more than your plan has left after bills. Pause one, or trim a contribution.{/if}
    </p>
  {/if}

  {#if goals.error}<p class="warn">{goals.error}</p>{/if}

  {#if goals.rows.length === 0}
    <p class="empty">No goals yet — add one above.</p>
  {:else}
    <div class="cards">
      {#each goals.rows as g, i (g.id)}
        {@const s = goals.status(g)}
        {@const phase = goals.phase(g)}
        {@const pct = Math.min(100, Math.round(Number(s.progress) * 100))}
        <div class="card" class:done={phase === "done"} class:active={phase === "active"} class:paused={phase === "paused"}>
          <div class="head">
            <span class="name">
              {#if phase === "done"}
                <span class="badge done" title="Target reached — this goal no longer claims your plan">✓</span>
              {:else}
                <button
                  class="badge toggle {phase}"
                  title={phase === "active" ? "Funded now — click to pause" : "Paused — click to fund it"}
                  aria-pressed={phase === "active"}
                  onclick={() => goals.toggleActive(g.id)}
                >{phase}</button>
              {/if}
              {#if editingId === g.id}
                <!-- svelte-ignore a11y_autofocus -->
                <input
                  class="nameedit"
                  autofocus
                  bind:value={editName}
                  onkeydown={(e) => renameKeys(e, g)}
                  onblur={() => commitRename(g)}
                />
              {:else}
                <button class="rename" title="Click to rename" onclick={() => startRename(g)}>{g.name}</button>
              {/if}
            </span>
            <span class="controls">
              <button class="move" title="Move earlier" disabled={i === 0} onclick={() => goals.reorder(g.id, -1)}>▲</button>
              <button class="move" title="Move later" disabled={i === goals.rows.length - 1} onclick={() => goals.reorder(g.id, 1)}>▼</button>
              <ConfirmButton onconfirm={() => goals.remove(g.id)} title="Delete goal" />
            </span>
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
            <div class="plan-row" title="How much you set aside for this goal, and how often">
              <span class="plan-lbl">Contribute</span>
              <input class="amt" type="number" min="0" step="any" placeholder="0" value={g.contribution ?? ""} onchange={(e) => setAmount(g, e.currentTarget.value)} />
              <select onchange={(e) => setCadence(g, e.currentTarget.value)}>
                {#each CADENCES as c (c)}<option value={c} selected={c === g.cadence}>{c}</option>{/each}
              </select>
            </div>
          {/if}
          {#if !s.complete}
            <div class="contrib">
              <input type="number" min="0" step="any" placeholder="Deposit $" bind:value={contribInput[g.id]} />
              <button
                onclick={() => {
                  goals.contribute(g.id, contribInput[g.id] ?? 0);
                  contribInput[g.id] = 0;
                }}
              >Log deposit</button>
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
  .lede strong {
    color: var(--color-gilt);
    font-weight: 400;
  }
  .committed {
    text-align: center;
    font-family: var(--font-body);
    font-size: 0.85rem;
    color: var(--color-soot);
    margin-bottom: 1rem;
  }
  .committed strong {
    color: var(--color-brass);
    font-weight: 400;
  }
  .committed.over {
    color: var(--color-oxblood);
  }
  .committed.over strong {
    color: var(--color-oxblood);
  }
  .mono {
    font-family: var(--font-mono);
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
  select {
    background: var(--color-coal);
    border: 1px solid var(--color-etch);
    border-radius: 6px;
    color: var(--color-parchment);
    font-family: var(--font-body);
    padding: 0.45rem 0.6rem;
    text-transform: capitalize;
  }
  .plan-row {
    display: flex;
    align-items: center;
    gap: 0.4rem;
    margin-top: 0.6rem;
  }
  .plan-lbl {
    font-family: var(--font-body);
    color: var(--color-soot);
    font-size: 0.82rem;
  }
  .plan-row .amt {
    width: 5.5rem;
  }
  .plan-row select {
    padding: 0.35rem 0.5rem;
    font-size: 0.85rem;
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
  .card.active {
    border-color: var(--color-brass);
    box-shadow: var(--bevel), 0 0 0 1px var(--color-brass);
  }
  .card.paused {
    opacity: 0.62;
  }
  .badge {
    font-family: var(--font-body);
    font-size: 0.62rem;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    padding: 0.1rem 0.4rem;
    border-radius: 4px;
    margin-right: 0.4rem;
    vertical-align: middle;
  }
  .badge.done {
    background: var(--color-lime-rust);
    color: var(--color-coal);
  }
  .badge.active {
    background: var(--color-brass);
    color: var(--color-coal);
  }
  .badge.paused {
    border: 1px solid var(--color-etch);
    background: transparent;
    color: var(--color-soot);
  }
  .badge.toggle {
    cursor: pointer;
    border: 1px solid transparent;
    font-family: var(--font-body);
  }
  .badge.toggle:hover {
    filter: brightness(1.15);
  }
  .badge.paused:hover {
    color: var(--color-brass);
    border-color: var(--color-brass);
  }
  .controls {
    display: inline-flex;
    align-items: center;
    gap: 0.3rem;
  }
  .move {
    background: transparent;
    border: 1px solid var(--color-etch);
    border-radius: 4px;
    color: var(--color-soot);
    cursor: pointer;
    font-size: 0.7rem;
    line-height: 1;
    padding: 0.15rem 0.3rem;
  }
  .move:hover:not(:disabled) {
    color: var(--color-gilt);
    border-color: var(--color-gilt);
  }
  .move:disabled {
    opacity: 0.35;
    cursor: default;
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
    min-width: 0;
    flex: 1;
  }
  /* The name reads as static text until hovered, then invites the click. */
  .rename {
    background: transparent;
    border: none;
    border-bottom: 1px dashed transparent;
    color: inherit;
    cursor: text;
    font: inherit;
    letter-spacing: inherit;
    padding: 0;
    text-align: left;
  }
  .rename:hover {
    border-bottom-color: var(--color-soot);
  }
  .nameedit {
    background: var(--color-coal);
    border: 1px solid var(--color-brass);
    border-radius: 4px;
    color: var(--color-gilt);
    font-family: var(--font-display);
    letter-spacing: 0.04em;
    font-size: 1rem;
    padding: 0.15rem 0.35rem;
    max-width: 100%;
    width: 11rem;
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
