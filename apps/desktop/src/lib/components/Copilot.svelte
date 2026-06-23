<script lang="ts">
  import { copilot } from "$lib/stores/copilot.svelte";

  let showKey = $state(false);

  function onkeydown(e: KeyboardEvent) {
    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) copilot.run();
  }
</script>

<section class="copilot">
  <div class="row">
    <span class="label">Copilot</span>
    <input
      class="req"
      placeholder="e.g. max out my 401k and put the rest in brokerage"
      bind:value={copilot.request}
      {onkeydown}
    />
    <button class="run" onclick={() => copilot.run()} disabled={copilot.running}>
      {copilot.running ? "Thinking…" : "Ask"}
    </button>
  </div>

  <div class="row key">
    <input
      class="apikey"
      type={showKey ? "text" : "password"}
      placeholder="Anthropic API key (stored locally)"
      bind:value={copilot.apiKey}
    />
    <button class="toggle" onclick={() => (showKey = !showKey)}>{showKey ? "hide" : "show"}</button>
  </div>

  {#if copilot.error}<p class="warn">{copilot.error}</p>{/if}
  {#if copilot.note}<p class="note">{copilot.note}</p>{/if}
  <p class="disclaimer">Natural-language requests become validated dial changes the engine applies. Only your dial percentages are sent — never balances or income.</p>
</section>

<style>
  .copilot {
    border: 1px solid var(--color-etch);
    border-radius: 10px;
    background: var(--color-panel);
    box-shadow: var(--bevel);
    padding: 1rem 1.25rem;
    margin-bottom: 2rem;
  }
  .row {
    display: flex;
    gap: 0.6rem;
    align-items: center;
  }
  .row.key {
    margin-top: 0.6rem;
  }
  .label {
    font-family: var(--font-display);
    letter-spacing: 0.1em;
    color: var(--color-gilt);
  }
  input {
    background: var(--color-coal);
    border: 1px solid var(--color-etch);
    border-radius: 6px;
    color: var(--color-parchment);
    font-family: var(--font-body);
    padding: 0.5rem 0.6rem;
  }
  .req {
    flex: 1;
  }
  .apikey {
    flex: 1;
    font-family: var(--font-meter);
    font-size: 0.85rem;
  }
  button {
    cursor: pointer;
    border-radius: 6px;
    font-family: var(--font-body);
  }
  .run {
    background: var(--color-brass);
    color: var(--color-coal);
    border: none;
    padding: 0.5rem 1.1rem;
  }
  .run:disabled {
    opacity: 0.6;
    cursor: default;
  }
  .toggle {
    background: transparent;
    border: 1px solid var(--color-etch);
    color: var(--color-soot);
    padding: 0.45rem 0.7rem;
    font-size: 0.8rem;
  }
  .warn {
    color: var(--color-oxblood);
    margin: 0.6rem 0 0;
  }
  .note {
    color: var(--color-lime-rust);
    font-family: var(--font-body);
    margin: 0.6rem 0 0;
  }
  .disclaimer {
    color: var(--color-dim);
    font-size: 0.75rem;
    margin: 0.6rem 0 0;
  }
</style>
