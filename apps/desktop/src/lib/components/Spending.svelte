<script lang="ts">
  import { onMount } from "svelte";
  import { Money } from "@mainspring/schema";
  import { cadenceAbbrev, formatPct, formatUsd } from "$lib/format";
  import { bucketLabel } from "$lib/buckets";
  import { spending } from "$lib/stores/spending.svelte";
  import { recurring } from "$lib/stores/recurring.svelte";
  import { goals } from "$lib/stores/goals.svelte";
  import { view } from "$lib/stores/derived.svelte";
  import { hints } from "$lib/stores/hints.svelte";
  import Donut from "./Donut.svelte";
  import Proportions from "./Proportions.svelte";
  import ConfirmButton from "./ConfirmButton.svelte";
  import RecurringRemove from "./RecurringRemove.svelte";

  const v = $derived(view.current);
  let showBreakdown = $state(false);
  let showBills = $state(false);
  const propSlices = $derived(v.whereItGoes.map((s) => ({ label: s.label, amount: Number(s.amount.toString()) })));

  // Cash-flow health, from take-home. Consumption (essentials + spending) is money
  // that's gone; the rest goes to the future (goals + investing). Spare derives from
  // the engine's Leftover slice and deficit (F12) — over budget ⟺ deficit > 0.
  const slice = (label: string) => v.whereItGoes.find((s) => s.label === label)?.amount ?? Money.zero();
  const consumption = $derived(slice("Bills & essentials").add(slice("Spending")));
  const toFuture = $derived(slice("Goals").add(slice("Investing")));
  const spare = $derived(slice("Leftover").subtract(v.deficit)); // gross − accounted (may be negative)
  const spareN = $derived(Number(spare.toString()));
  const deficitN = $derived(Number(v.deficit.toString()));
  const mo = (m: Money) => Number(m.toString()) / 12;

  // Group logged spending by month (rows already arrive newest-first).
  const months = $derived(
    (() => {
      const map = new Map<string, { key: string; label: string; total: number; items: typeof spending.rows }>();
      for (const r of spending.rows) {
        const key = String(r.spentAt).slice(0, 7);
        let g = map.get(key);
        if (!g) {
          const label = new Date(key + "-01T00:00:00").toLocaleDateString("en-US", { month: "long", year: "numeric" });
          g = { key, label, total: 0, items: [] };
          map.set(key, g);
        }
        g.total += Number(r.amount);
        g.items.push(r);
      }
      return [...map.values()];
    })(),
  );
  // A month is open by default only if it's the newest; overrides track user toggles.
  let overrides = $state<Record<string, boolean>>({});
  const isOpen = (key: string, i: number) => overrides[key] ?? i === 0;
  const toggleMonth = (key: string, i: number) => (overrides[key] = !isOpen(key, i));

  // "By category" sits next to a month-grouped history, so it takes a period too
  // — otherwise it shows lifetime totals beside a single month's entries. Null
  // means all time; default to the newest logged month, matching History's
  // newest-open default.
  let catPeriod = $state<string | null>(null);
  let catPeriodTouched = $state(false);
  const activePeriod = $derived(catPeriodTouched ? catPeriod : (spending.loggedMonths[0] ?? null));
  const monthLabel = (key: string) => new Date(key + "-01T00:00:00").toLocaleDateString("en-US", { month: "short", year: "numeric" });
  function setPeriod(p: string | null) {
    catPeriod = p;
    catPeriodTouched = true;
    openCats = {};
  }

  // Expand a spending category to its individual entries — within the same period.
  let openCats = $state<Record<string, boolean>>({});
  const catOpen = (c: string) => openCats[c] ?? false;
  const toggleCat = (c: string) => (openCats[c] = !catOpen(c));
  const itemsOf = (c: string) => spending.rowsIn(activePeriod).filter((r) => r.category === c);

  // Expand a budget line to the pieces that make it up.
  let openLines = $state<Record<string, boolean>>({});
  const lineOpen = (l: string) => openLines[l] ?? false;
  const toggleLine = (l: string) => (openLines[l] = !lineOpen(l));

  function detailsFor(label: string): { name: string; amount: number }[] {
    switch (label) {
      case "Taxes":
        return [
          { name: "Federal", amount: Number(v.tax.federal.toString()) },
          { name: "FICA (Social Security + Medicare)", amount: Number(v.tax.fica.toString()) },
          { name: "State", amount: Number(v.tax.state.toString()) },
          { name: "Capital gains", amount: Number(v.tax.capitalGains.toString()) },
        ].filter((d) => d.amount > 0);
      case "Investing": {
        const items = v.buckets.map((b) => ({ name: bucketLabel(b.bucket), amount: Number(b.amount.toString()) }));
        const auto = Number(v.autoInvestments.toString());
        if (auto > 0) items.push({ name: "Auto-invest (recurring)", amount: auto });
        return items.filter((d) => d.amount > 0);
      }
      case "Bills & essentials":
        return recurring.bills
          .filter((r) => recurring.live(r))
          .map((r) => ({ name: r.label, amount: Number(recurring.annual(r).toString()) }));
      case "Goals": {
        const active = goals.rows.find((g) => g.id === goals.activeId);
        return active?.contribution ? [{ name: active.name, amount: Number(goals.annual(active).toString()) }] : [];
      }
      case "Spending": {
        // Annualize each category proportionally so the parts match the slice total.
        // Uses the trailing window's mix — the same rows the slice itself annualizes.
        const raw = spending.windowByCategory;
        const rawTotal = raw.reduce((s, c) => s + Number(c.total.toString()), 0);
        const annual = Number(slice("Spending").toString());
        if (rawTotal <= 0) return [];
        return raw.map((c) => ({ name: c.category, amount: (Number(c.total.toString()) / rawTotal) * annual }));
      }
      default:
        return [];
    }
  }

  const CATEGORIES = ["software dev", "dining", "groceries", "clothes", "entertainment", "transport", "subscriptions", "other"];
  const BILL_CATEGORIES = ["rent", "mortgage", "groceries", "utilities", "insurance", "car", "phone", "software dev", "api", "subscription", "loan", "other"];
  const CADENCES = ["weekly", "biweekly", "monthly", "quarterly", "annual"] as const;
  const today = () => new Date().toISOString().slice(0, 10);
  let draft = $state({ category: "", label: "", amount: 0, date: today() });
  let bill = $state<{ label: string; category: string; amount: number; cadence: (typeof CADENCES)[number] }>({
    label: "",
    category: "",
    amount: 0,
    cadence: "monthly",
  });

  onMount(() => {
    void spending.load();
    void recurring.load();
  });

  async function add(e: Event) {
    e.preventDefault();
    // A note is required — the category alone doesn't say what a purchase was.
    if (!draft.category.trim() || draft.amount <= 0 || !draft.label.trim()) return;
    await spending.add({
      id: crypto.randomUUID(),
      category: draft.category.trim().toLowerCase(),
      label: draft.label.trim(),
      amount: String(draft.amount),
      spentAt: draft.date,
    });
    draft = { category: "", label: "", amount: 0, date: today() };
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
    bill = { label: "", category: "", amount: 0, cadence: bill.cadence };
  }
</script>

<section class="spending">
  <header class="title">Outflows</header>
  {#if hints.show}
    <p class="lede">Everything leaving your account — fixed commitments and day-to-day spending. Both feed your total expenses, so your savings pool and freedom date move with them.</p>
  {/if}

  <div class="cashflow" class:over={deficitN > 0}>
    <div class="verdict">
      {#if deficitN > 0}
        <span class="tag red">Over budget</span>
        <span class="msg">You're spending <strong>{formatUsd(mo(v.deficit))}/mo</strong> more than you take home. Trim spending, bills, or contributions.</span>
      {:else if mo(spare) < mo(v.net) * 0.03}
        <span class="tag amber">Fully allocated</span>
        <span class="msg">Every dollar is spoken for — about <strong>{formatUsd(mo(spare))}/mo</strong> spare. No cushion for surprises.</span>
      {:else}
        <span class="tag green">In the black</span>
        <span class="msg">You live within your means and invest <strong>{formatPct(v.savingsRate)}</strong> of take-home, with <strong>{formatUsd(mo(spare))}/mo</strong> to spare.</span>
      {/if}
    </div>
    <div class="flow">
      <span class="item"><span class="k">Take-home</span><span class="mono">{formatUsd(mo(v.net))}/mo</span></span>
      <span class="op">−</span>
      <span class="item"><span class="k">Essentials + spending</span><span class="mono">{formatUsd(mo(consumption))}/mo</span></span>
      <span class="op">−</span>
      <span class="item"><span class="k">Goals + investing</span><span class="mono">{formatUsd(mo(toFuture))}/mo</span></span>
      <span class="op">=</span>
      <span class="item"><span class="k">Spare</span><span class="mono" class:neg={spareN < 0}>{formatUsd(mo(spare))}/mo</span></span>
    </div>

    <button class="breakdown-toggle" onclick={() => (showBreakdown = !showBreakdown)}>
      {showBreakdown ? "▾ hide breakdown" : "▸ see where every dollar goes"}
    </button>
    {#if showBreakdown}
      <div class="breakdown">
        <Proportions slices={propSlices} total={Number(v.gross.toString())} />
        <table class="lines">
          <tbody>
            {#each v.whereItGoes as s (s.label)}
              {#if Number(s.amount.toString()) > 0}
                {@const dets = detailsFor(s.label)}
                <tr>
                  <td class="cap">
                    {#if dets.length > 0}
                      <button class="expand" onclick={() => toggleLine(s.label)}>{lineOpen(s.label) ? "▾" : "▸"} {s.label}</button>
                    {:else}<span class="noexp">{s.label}</span>{/if}
                  </td>
                  <td class="mono">{formatUsd(mo(s.amount))}/mo</td>
                  <td class="mono muted">{formatUsd(Number(s.amount.toString()))}/yr</td>
                  <td class="mono muted">{Math.round((Number(s.amount.toString()) / Number(v.gross.toString())) * 100)}%</td>
                </tr>
                {#if lineOpen(s.label)}
                  {#each dets as d (d.name)}
                    <tr class="detail">
                      <td class="cap sub">{d.name}</td>
                      <td class="mono muted">{formatUsd(d.amount / 12)}/mo</td>
                      <td class="mono muted">{formatUsd(d.amount)}/yr</td>
                      <td></td>
                    </tr>
                  {/each}
                {/if}
              {/if}
            {/each}
            {#if deficitN > 0}
              <tr class="deficit-row">
                <td class="cap">Over budget</td>
                <td class="mono">−{formatUsd(mo(v.deficit))}/mo</td>
                <td class="mono">−{formatUsd(deficitN)}/yr</td>
                <td class="mono">{Math.round((deficitN / Number(v.gross.toString())) * 100)}%</td>
              </tr>
            {/if}
          </tbody>
        </table>
      </div>
    {/if}
  </div>

  <div class="block">
    <button class="block-head" onclick={() => (showBills = !showBills)}>
      <span class="block-title">{showBills ? "▾" : "▸"} Bills &amp; essentials</span>
      <span class="block-total">{formatUsd(Number(recurring.billsAnnual.toString()))}/yr<span class="dim"> · {recurring.bills.length}</span></span>
    </button>
    {#if showBills}
    {#if hints.show}
      <p class="hint">Everything fixed and recurring — rent/mortgage, groceries, utilities, insurance, car, subscriptions, API costs. Itemize them here and they drill down under "Bills &amp; essentials" in your budget.</p>
    {/if}

    <form class="add" onsubmit={addBill}>
      <input class="lbl" placeholder="What is it? (e.g. Rent, Car insurance)" bind:value={bill.label} />
      <input class="cat" list="bills" placeholder="Category" bind:value={bill.category} />
      <datalist id="bills">{#each BILL_CATEGORIES as c (c)}<option value={c}></option>{/each}</datalist>
      <input type="number" min="0" step="any" placeholder="Amount" bind:value={bill.amount} />
      <select bind:value={bill.cadence}>
        {#each CADENCES as c (c)}<option value={c}>{c}</option>{/each}
      </select>
      <button type="submit">Add</button>
    </form>

    {#if recurring.error}<p class="warn">{recurring.error}</p>{/if}

    {#if recurring.bills.length > 0}
      <table class="bills">
        <tbody>
          {#each recurring.bills as r (r.id)}
            <tr class:paused={!recurring.live(r)}>
              <td class="cap">{r.label}<span class="dim"> · {r.category}</span>{#if r.endsOn}<span class="dim"> · ends {r.endsOn.slice(5)}</span>{/if}</td>
              <td class="mono">{formatUsd(Number(r.amount))}<span class="dim">/{cadenceAbbrev(r.cadence)}</span></td>
              <td class="mono">{formatUsd(Number(recurring.annual(r).toString()))}<span class="dim">/yr</span></td>
              <td><button class="link" onclick={() => recurring.toggle(r.id)}>{r.active ? "pause" : "resume"}</button></td>
              <td><RecurringRemove onEndAfterMonth={() => recurring.endAfterThisMonth(r.id)} onRemoveNow={() => recurring.remove(r.id)} title="Remove bill" /></td>
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
    {/if}
  </div>

  <h2 class="section">Variable spending</h2>
  {#if hints.show}
    <p class="hint">Discretionary purchases. The plan uses <strong>this month's</strong> spending projected out, and resets at the start of each month — so one heavy month doesn't haunt your budget forever.</p>
  {/if}

  <form class="add" onsubmit={add}>
    <input class="cat" list="cats" placeholder="Category" bind:value={draft.category} />
    <datalist id="cats">{#each CATEGORIES as c (c)}<option value={c}></option>{/each}</datalist>
    <input class="lbl" placeholder="What was it? (required)" required bind:value={draft.label} />
    <input type="number" min="0" step="any" placeholder="Amount" bind:value={draft.amount} />
    <input type="date" bind:value={draft.date} />
    <button type="submit">Log</button>
  </form>

  <div class="summary">
    <span>Last {spending.windowDays} days: <strong>{formatUsd(Number(spending.windowTotal.toString()))}</strong> · ~{formatUsd(Number(spending.annualized.toString()))}/yr projected</span>
    <span class="sub">This month so far: {formatUsd(Number(spending.thisMonthTotal.toString()))}</span>
  </div>

  {#if spending.error}<p class="warn">{spending.error}</p>{/if}

  {#if spending.byCategory.length > 0}
    <div class="grid">
      <div class="col">
        <div class="col-head">
          <h3>By category</h3>
          <div class="periods">
            {#each spending.loggedMonths.slice(0, 6) as m (m)}
              <button class="period" class:on={activePeriod === m} onclick={() => setPeriod(m)}>{monthLabel(m)}</button>
            {/each}
            <button class="period" class:on={activePeriod === null} onclick={() => setPeriod(null)}>All time</button>
          </div>
        </div>
        <table>
          <tbody>
            {#each spending.byCategoryIn(activePeriod) as c (c.category)}
              <tr>
                <td class="cap"><button class="expand" onclick={() => toggleCat(c.category)}>{catOpen(c.category) ? "▾" : "▸"} {c.category}</button></td>
                <td class="mono">{formatUsd(Number(c.total.toString()))}</td>
              </tr>
              {#if catOpen(c.category)}
                {#each itemsOf(c.category) as r (r.id)}
                  <tr class="detail">
                    <td class="sub"><span class="mono date">{String(r.spentAt).slice(5)}</span> <span class="dim">{r.label}</span></td>
                    <td class="mono muted">{formatUsd(Number(r.amount))}</td>
                  </tr>
                {/each}
              {/if}
            {/each}
          </tbody>
        </table>
      </div>
      <div class="col">
        <h3>History</h3>
        <!-- Grouped by month, newest open. Collapsed months keep the list short no
             matter how many entries pile up over the years. -->
        {#each months as m, i (m.key)}
          <div class="month">
            <button class="month-head" onclick={() => toggleMonth(m.key, i)}>
              <span class="caret">{isOpen(m.key, i) ? "▾" : "▸"}</span>
              <span class="mlabel">{m.label}</span>
              <span class="count">{m.items.length}</span>
              <span class="mono mtotal">{formatUsd(m.total)}</span>
            </button>
            {#if isOpen(m.key, i)}
              <table>
                <tbody>
                  {#each m.items as r (r.id)}
                    <tr>
                      <td class="mono date">{String(r.spentAt).slice(5)}</td>
                      <td class="catcell">
                        <input
                          class="catedit"
                          list="cats"
                          value={r.category}
                          title="Click to re-categorize"
                          onchange={(e) => spending.update({ ...r, category: e.currentTarget.value.trim().toLowerCase() || r.category })}
                        />
                        {#if r.label}<span class="dim"> · {r.label}</span>{/if}
                      </td>
                      <td class="mono">{formatUsd(Number(r.amount))}</td>
                      <td><ConfirmButton onconfirm={() => spending.remove(r.id)} title="Delete entry" /></td>
                    </tr>
                  {/each}
                </tbody>
              </table>
            {/if}
          </div>
        {/each}
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
  .summary .sub {
    display: block;
    margin-top: 0.25rem;
    color: var(--color-dim);
    font-size: 0.78rem;
    letter-spacing: 0.04em;
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
  .col-head {
    margin-bottom: 0.4rem;
  }
  .periods {
    display: flex;
    flex-wrap: wrap;
    gap: 0.25rem;
    margin-bottom: 0.5rem;
  }
  .period {
    background: transparent;
    border: 1px solid var(--color-etch);
    border-radius: 4px;
    color: var(--color-soot);
    cursor: pointer;
    font-family: var(--font-body);
    font-size: 0.68rem;
    letter-spacing: 0.04em;
    padding: 0.15rem 0.45rem;
  }
  .period:hover {
    color: var(--color-gilt);
    border-color: var(--color-gilt);
  }
  .period.on {
    background: var(--color-brass);
    border-color: var(--color-brass);
    color: var(--color-coal);
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
  .block-head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    width: 100%;
    background: transparent;
    border: none;
    cursor: pointer;
    padding: 0;
  }
  .block-title {
    font-family: var(--font-display);
    color: var(--color-gilt);
    letter-spacing: 0.1em;
    font-size: 1rem;
  }
  .block-head:hover .block-title {
    color: var(--color-parchment);
  }
  .block-total {
    font-family: var(--font-meter);
    color: var(--color-copper);
    font-size: 0.95rem;
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
  .cashflow {
    border: 1px solid var(--color-etch);
    border-left: 3px solid var(--color-lime-rust);
    border-radius: 10px;
    background: var(--color-panel);
    box-shadow: var(--bevel);
    padding: 1rem 1.25rem;
    margin-bottom: 2.5rem;
  }
  .cashflow.over {
    border-left-color: var(--color-oxblood);
  }
  .verdict {
    display: flex;
    align-items: baseline;
    gap: 0.75rem;
    flex-wrap: wrap;
    margin-bottom: 0.9rem;
  }
  .tag {
    font-family: var(--font-display);
    letter-spacing: 0.08em;
    font-size: 0.8rem;
    padding: 0.2rem 0.6rem;
    border-radius: 5px;
    white-space: nowrap;
  }
  .tag.green {
    color: var(--color-coal);
    background: var(--color-lime-rust);
  }
  .tag.amber {
    color: var(--color-coal);
    background: var(--color-gilt);
  }
  .tag.red {
    color: var(--color-parchment);
    background: var(--color-oxblood);
  }
  .msg {
    color: var(--color-soot);
    font-family: var(--font-body);
    font-size: 0.9rem;
  }
  .msg strong {
    color: var(--color-parchment);
    font-family: var(--font-meter);
  }
  .flow {
    display: flex;
    align-items: center;
    gap: 0.6rem;
    flex-wrap: wrap;
    font-family: var(--font-body);
  }
  .flow .item {
    display: flex;
    flex-direction: column;
  }
  .flow .k {
    color: var(--color-dim);
    font-size: 0.72rem;
    text-transform: uppercase;
    letter-spacing: 0.04em;
  }
  .flow .mono {
    font-family: var(--font-meter);
    color: var(--color-parchment);
  }
  .flow .op {
    color: var(--color-soot);
    font-family: var(--font-meter);
  }
  .flow .neg {
    color: var(--color-oxblood);
  }
  .month {
    border-bottom: 1px solid var(--color-etch);
  }
  .month-head {
    display: flex;
    align-items: center;
    gap: 0.6rem;
    width: 100%;
    background: transparent;
    border: none;
    cursor: pointer;
    padding: 0.5rem 0.2rem;
    color: var(--color-parchment);
    font-family: var(--font-body);
  }
  .month-head:hover {
    color: var(--color-gilt);
  }
  .caret {
    color: var(--color-soot);
    width: 1rem;
  }
  .mlabel {
    flex: 1;
    text-align: left;
  }
  .count {
    color: var(--color-dim);
    font-family: var(--font-meter);
    font-size: 0.78rem;
  }
  .mtotal {
    color: var(--color-copper);
    font-family: var(--font-meter);
  }
  .catcell {
    text-align: left;
  }
  .catedit {
    background: transparent;
    border: none;
    border-bottom: 1px dashed transparent;
    color: var(--color-parchment);
    font-family: var(--font-body);
    text-transform: capitalize;
    padding: 0.1rem 0;
    width: 8rem;
    cursor: pointer;
  }
  .catedit:hover {
    border-bottom-color: var(--color-etch);
  }
  .catedit:focus {
    outline: none;
    border-bottom-color: var(--color-gilt);
    cursor: text;
  }
  .breakdown-toggle {
    background: transparent;
    border: none;
    color: var(--color-soot);
    cursor: pointer;
    font-family: var(--font-body);
    font-size: 0.82rem;
    padding: 0.6rem 0 0;
  }
  .breakdown-toggle:hover {
    color: var(--color-gilt);
  }
  .breakdown {
    margin-top: 0.8rem;
  }
  .lines {
    width: 100%;
    border-collapse: collapse;
    margin-top: 0.9rem;
    font-family: var(--font-meter);
  }
  .lines td {
    text-align: right;
    padding: 0.3rem 0.5rem;
    border-bottom: 1px solid var(--color-etch);
    color: var(--color-parchment);
  }
  .lines td.cap {
    text-align: left;
    font-family: var(--font-body);
  }
  .lines .muted {
    color: var(--color-soot);
    font-size: 0.85rem;
  }
  .deficit-row td {
    color: var(--color-oxblood);
    border-top: 1px solid var(--color-oxblood);
  }
  .expand {
    background: transparent;
    border: none;
    color: var(--color-parchment);
    cursor: pointer;
    font: inherit;
    text-transform: capitalize;
    padding: 0;
  }
  .expand:hover {
    color: var(--color-gilt);
  }
  .noexp {
    padding-left: 0.9rem;
  }
  .detail td {
    color: var(--color-soot);
    font-size: 0.85rem;
    border-bottom: 1px solid var(--color-etch);
  }
  .detail .sub {
    padding-left: 1.2rem;
    text-transform: capitalize;
  }
  .detail .muted {
    color: var(--color-soot);
    font-size: 0.85rem;
  }
</style>
