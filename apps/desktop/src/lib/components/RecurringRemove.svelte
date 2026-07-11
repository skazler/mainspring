<script lang="ts">
  // A remove control for recurring items that asks *when*: keep it through the
  // current month (its charge already hit) and drop it next month, or remove it
  // outright now.
  interface Props {
    onEndAfterMonth: () => void;
    onRemoveNow: () => void;
    title?: string;
  }
  let { onEndAfterMonth, onRemoveNow, title = "Remove" }: Props = $props();

  let armed = $state(false);
  let timer: ReturnType<typeof setTimeout> | undefined;

  function arm() {
    armed = true;
    clearTimeout(timer);
    timer = setTimeout(() => (armed = false), 4500);
  }
  function pick(fn: () => void) {
    clearTimeout(timer);
    armed = false;
    fn();
  }
</script>

{#if armed}
  <span class="confirm">
    <span class="q">remove:</span>
    <button class="opt" onclick={() => pick(onEndAfterMonth)} title="Keep it through this month, then drop it next month">next month</button>
    <button class="opt danger" onclick={() => pick(onRemoveNow)} title="Remove it entirely, effective now">now</button>
    <button class="no" onclick={() => (armed = false)} title="Cancel">✕</button>
  </span>
{:else}
  <button class="trigger" {title} aria-label={title} onclick={arm}>✕</button>
{/if}

<style>
  .confirm {
    display: inline-flex;
    gap: 0.3rem;
    align-items: center;
  }
  .q {
    color: var(--color-soot);
    font-family: var(--font-body);
    font-size: 0.75rem;
  }
  .opt {
    background: transparent;
    border: 1px solid var(--color-etch);
    border-radius: 5px;
    color: var(--color-parchment);
    cursor: pointer;
    padding: 0.15rem 0.45rem;
    font-family: var(--font-body);
    font-size: 0.75rem;
  }
  .opt:hover {
    border-color: var(--color-gilt);
    color: var(--color-gilt);
  }
  .opt.danger:hover {
    border-color: var(--color-oxblood);
    color: var(--color-oxblood);
  }
  .no {
    background: transparent;
    border: none;
    color: var(--color-soot);
    cursor: pointer;
    padding: 0.1rem 0.3rem;
    font-size: 0.78rem;
  }
  .no:hover {
    color: var(--color-parchment);
  }
  .trigger {
    background: transparent;
    border: none;
    color: var(--color-oxblood);
    cursor: pointer;
    font: inherit;
    padding: 0;
  }
  .trigger:hover {
    color: var(--color-gilt);
  }
</style>
