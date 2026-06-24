<script lang="ts">
  import { assistant } from "$lib/stores/assistant.svelte";

  let showKey = $state(false);

  function onkeydown(e: KeyboardEvent) {
    if (e.key === "Enter") assistant.ask();
  }
</script>

<section class="assistant">
  <div class="row">
    <span class="label">Assistant</span>
    <input
      class="req"
      placeholder="Ask about your plan, or say 'shift 5% from brokerage to my 401k'"
      bind:value={assistant.request}
      {onkeydown}
    />
    <button class="run" onclick={() => assistant.ask()} disabled={assistant.running}>
      {assistant.running ? "Thinking…" : "Ask"}
    </button>
  </div>

  <div class="row key">
    <input
      class="apikey"
      type={showKey ? "text" : "password"}
      placeholder="Anthropic API key (stored locally)"
      bind:value={assistant.apiKey}
    />
    <button class="toggle" onclick={() => (showKey = !showKey)}>{showKey ? "hide" : "show"}</button>
  </div>

  {#if assistant.error}<p class="warn">{assistant.error}</p>{/if}
  {#if assistant.reply}
    <p class="reply">{assistant.reply}</p>
    {#if assistant.applied > 0}<p class="applied">Applied {assistant.applied} dial change{assistant.applied === 1 ? "" : "s"}.</p>{/if}
  {/if}
  <p class="disclaimer">Answers plan questions and can apply validated dial changes. Only dial percentages and derived ratios/ages are sent — never balances or income. Informational, not advice.</p>
</section>

<style>
  .assistant {
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
  .reply {
    color: var(--color-parchment);
    font-family: var(--font-body);
    margin: 0.6rem 0 0;
    white-space: pre-wrap;
  }
  .applied {
    color: var(--color-lime-rust);
    font-family: var(--font-body);
    margin: 0.3rem 0 0;
  }
  .disclaimer {
    color: var(--color-dim);
    font-size: 0.75rem;
    margin: 0.6rem 0 0;
  }
</style>
