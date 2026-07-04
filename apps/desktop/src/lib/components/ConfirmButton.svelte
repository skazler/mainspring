<script lang="ts">
  interface Props {
    onconfirm: () => void;
    /** Trigger glyph/label (default ✕). */
    label?: string;
    title?: string;
    /** Text shown in the armed state. */
    confirmLabel?: string;
  }
  let { onconfirm, label = "✕", title = "Delete", confirmLabel = "delete?" }: Props = $props();

  let armed = $state(false);
  let timer: ReturnType<typeof setTimeout> | undefined;

  function arm() {
    armed = true;
    clearTimeout(timer);
    timer = setTimeout(() => (armed = false), 3500); // auto-cancel if ignored
  }
  function go() {
    clearTimeout(timer);
    armed = false;
    onconfirm();
  }
</script>

{#if armed}
  <span class="confirm">
    <button class="yes" onclick={go} title="Confirm">{confirmLabel}</button>
    <button class="no" onclick={() => (armed = false)} title="Cancel">✕</button>
  </span>
{:else}
  <button class="trigger" {title} aria-label={title} onclick={arm}>{label}</button>
{/if}

<style>
  .confirm {
    display: inline-flex;
    gap: 0.3rem;
    align-items: center;
  }
  .yes {
    background: var(--color-oxblood);
    color: var(--color-parchment);
    border: none;
    border-radius: 5px;
    padding: 0.15rem 0.5rem;
    cursor: pointer;
    font-family: var(--font-body);
    font-size: 0.78rem;
    letter-spacing: 0.02em;
  }
  .no {
    background: transparent;
    border: 1px solid var(--color-etch);
    border-radius: 5px;
    color: var(--color-soot);
    cursor: pointer;
    padding: 0.1rem 0.4rem;
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
