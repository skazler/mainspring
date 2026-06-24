<script lang="ts">
  import { almanac } from "$lib/stores/almanac.svelte";

  let showKey = $state(false);

  function onkeydown(e: KeyboardEvent) {
    if (e.key === "Enter") almanac.ask();
  }
</script>

<section class="almanac">
  <div class="row">
    <span class="label">The Almanac<span class="sub">plan assistant</span></span>
    <input
      class="req"
      placeholder="Consult the Almanac — ask about your plan, or say 'shift 5% to my 401k'"
      bind:value={almanac.request}
      {onkeydown}
    />
    <button class="run" onclick={() => almanac.ask()} disabled={almanac.running}>
      {almanac.running ? "Consulting…" : "Consult"}
    </button>
  </div>

  <div class="row key">
    <input
      class="apikey"
      type={showKey ? "text" : "password"}
      placeholder="Anthropic API key (stored locally)"
      bind:value={almanac.apiKey}
    />
    <button class="toggle" onclick={() => (showKey = !showKey)}>{showKey ? "hide" : "show"}</button>
  </div>

  {#if almanac.error}<p class="warn">{almanac.error}</p>{/if}
  {#if almanac.reply}
    <p class="reply">{almanac.reply}</p>
    {#if almanac.applied > 0}<p class="applied">Applied {almanac.applied} dial change{almanac.applied === 1 ? "" : "s"}.</p>{/if}
  {/if}
  <p class="disclaimer">Answers plan questions and can apply validated dial changes. Only dial percentages and derived ratios/ages are sent — never balances or income. Informational, not advice.</p>
</section>

<style>
  .almanac {
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
    display: flex;
    flex-direction: column;
    font-family: var(--font-display);
    letter-spacing: 0.1em;
    color: var(--color-gilt);
    white-space: nowrap;
  }
  .sub {
    font-family: var(--font-body);
    letter-spacing: 0.02em;
    color: var(--color-dim);
    font-size: 0.65rem;
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
