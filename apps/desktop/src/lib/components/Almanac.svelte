<script lang="ts">
  import { almanac } from "$lib/stores/almanac.svelte";

  let open = $state(false);
  let showKey = $state(false);

  function consult() {
    if (!almanac.hasKey) {
      showKey = true; // no key yet — reveal the field
      return;
    }
    showKey = false;
    almanac.ask();
  }
  async function saveKey() {
    await almanac.saveKey();
    if (almanac.hasKey) {
      showKey = false;
      if (almanac.request.trim()) almanac.ask();
    }
  }
  function onkeydown(e: KeyboardEvent) {
    if (e.key === "Enter") consult();
  }
</script>

{#if !open}
  <div class="collapsed">
    <button class="pill" onclick={() => (open = true)}>✦ Consult the Almanac</button>
  </div>
{:else}
  <section class="almanac">
    <div class="bar">
      <span class="label">The Almanac<span class="sub">plan assistant</span></span>
      <button class="close" title="Collapse" onclick={() => (open = false)}>▾</button>
    </div>

    {#if almanac.messages.length > 0}
      <div class="thread">
        {#each almanac.messages as m, i (i)}
          <div class="msg {m.role}">{m.text}</div>
        {/each}
        {#if almanac.running}<div class="msg assistant thinking">Consulting…</div>{/if}
      </div>
    {/if}

    <div class="row">
      <input
        class="req"
        placeholder="Ask about your plan, or say 'shift 5% to my 401k'"
        bind:value={almanac.request}
        {onkeydown}
      />
      <button class="run" onclick={consult} disabled={almanac.running}>
        {almanac.running ? "…" : "Ask"}
      </button>
    </div>

    {#if showKey}
      <div class="row key">
        <input
          class="apikey"
          type="password"
          placeholder="Paste your Anthropic API key (stored in your OS keychain, never in the app)"
          bind:value={almanac.apiKey}
          onkeydown={(e) => e.key === "Enter" && saveKey()}
        />
        <button class="toggle" onclick={saveKey}>Save</button>
      </div>
    {/if}

    {#if almanac.error}<p class="warn">{almanac.error}</p>{/if}
    <p class="disclaimer">
      Only dial percentages and derived ratios/ages are sent — never balances or income. Informational, not advice.{#if almanac.hasKey}
        <button class="linkkey" onclick={() => (showKey = !showKey)}>· change key</button>{/if}
    </p>
  </section>
{/if}

<style>
  .collapsed {
    position: fixed;
    right: 1.25rem;
    bottom: 1.25rem;
    z-index: 50;
  }
  .pill {
    background: var(--color-panel);
    border: 1px solid var(--color-etch);
    border-radius: 999px;
    color: var(--color-soot);
    font-family: var(--font-body);
    font-size: 0.8rem;
    padding: 0.4rem 0.9rem;
    cursor: pointer;
    box-shadow: var(--bevel);
    opacity: 0.75;
  }
  .pill:hover {
    color: var(--color-gilt);
    border-color: var(--color-gilt);
    opacity: 1;
  }
  .almanac {
    position: fixed;
    right: 1.25rem;
    bottom: 1.25rem;
    z-index: 50;
    width: min(380px, calc(100vw - 2.5rem));
    border: 1px solid var(--color-etch);
    border-radius: 10px;
    background: var(--color-panel);
    box-shadow: var(--bevel);
    padding: 1rem 1.25rem;
  }
  .bar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 0.75rem;
  }
  .label {
    display: flex;
    flex-direction: column;
    font-family: var(--font-display);
    letter-spacing: 0.1em;
    color: var(--color-gilt);
  }
  .sub {
    font-family: var(--font-body);
    letter-spacing: 0.02em;
    color: var(--color-dim);
    font-size: 0.65rem;
  }
  .close {
    background: transparent;
    border: 1px solid var(--color-etch);
    border-radius: 6px;
    color: var(--color-soot);
    cursor: pointer;
    padding: 0.2rem 0.6rem;
  }
  .thread {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    max-height: 16rem;
    overflow-y: auto;
    margin-bottom: 0.75rem;
    padding-right: 0.25rem;
  }
  .msg {
    font-family: var(--font-body);
    padding: 0.5rem 0.7rem;
    border-radius: 8px;
    max-width: 85%;
    white-space: pre-wrap;
    font-size: 0.9rem;
  }
  .msg.user {
    align-self: flex-end;
    background: var(--color-raised);
    color: var(--color-parchment);
  }
  .msg.assistant {
    align-self: flex-start;
    background: var(--color-coal);
    color: var(--color-parchment);
    border: 1px solid var(--color-etch);
  }
  .msg.thinking {
    color: var(--color-dim);
    font-style: italic;
  }
  .row {
    display: flex;
    gap: 0.6rem;
    align-items: center;
  }
  .row.key {
    margin-top: 0.6rem;
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
  .disclaimer {
    color: var(--color-dim);
    font-size: 0.75rem;
    margin: 0.6rem 0 0;
  }
  .linkkey {
    background: transparent;
    border: none;
    color: var(--color-dim);
    font-size: 0.75rem;
    cursor: pointer;
    padding: 0;
    font-family: var(--font-body);
  }
  .linkkey:hover {
    color: var(--color-soot);
    text-decoration: underline;
  }
</style>
