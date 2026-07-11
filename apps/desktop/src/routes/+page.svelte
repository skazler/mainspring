<script lang="ts">
  import { onMount } from "svelte";
  import DialConsole from "$lib/components/DialConsole.svelte";
  import Holdings from "$lib/components/Holdings.svelte";
  import Spending from "$lib/components/Spending.svelte";
  import Goals from "$lib/components/Goals.svelte";
  import Setup from "$lib/components/Setup.svelte";
  import Calibre from "$lib/components/Calibre.svelte";
  import BackupControls from "$lib/components/BackupControls.svelte";
  import { initSession, session } from "$lib/stores/session.svelte";
  import { hints } from "$lib/stores/hints.svelte";

  let showData = $state(false);

  onMount(() => {
    void initSession();
  });
</script>

{#if !session.loaded}
  <p class="loading">Winding up…</p>
{:else if session.configured}
  <div class="topbar">
    <nav class="tabs">
      <button class:active={session.tab === "plan"} onclick={() => (session.tab = "plan")}>Plan</button>
      <button class:active={session.tab === "calibre"} onclick={() => (session.tab = "calibre")}>Calibre</button>
      <button class:active={session.tab === "holdings"} onclick={() => (session.tab = "holdings")}>Registers</button>
      <button class:active={session.tab === "spending"} onclick={() => (session.tab = "spending")}>Outflows</button>
      <button class:active={session.tab === "goals"} onclick={() => (session.tab = "goals")}>Goals</button>
    </nav>
    <div class="tools">
      <button class="tool" class:on={hints.show} title="Show or hide explanatory tips" onclick={() => hints.toggle()}>ⓘ</button>
      <button class="tool" class:on={showData} title="Back up or restore your data" onclick={() => (showData = !showData)}>⇅</button>
    </div>
  </div>
  {#if showData}
    <div class="data-panel"><BackupControls /></div>
  {/if}
  {#if session.tab === "plan"}
    <DialConsole />
  {:else if session.tab === "calibre"}
    <Calibre />
  {:else if session.tab === "holdings"}
    <Holdings />
  {:else if session.tab === "spending"}
    <Spending />
  {:else}
    <Goals />
  {/if}
{:else}
  <Setup />
{/if}

<style>
  .loading {
    text-align: center;
    margin-top: 25vh;
    color: var(--color-soot);
    font-family: var(--font-display);
    letter-spacing: 0.2em;
  }
  .topbar {
    position: relative;
    padding: 1.25rem 0 0;
  }
  .tabs {
    display: flex;
    justify-content: center;
    gap: 0.5rem;
  }
  .tabs button {
    background: transparent;
    border: 1px solid var(--color-etch);
    border-radius: 6px;
    color: var(--color-soot);
    font-family: var(--font-display);
    letter-spacing: 0.12em;
    padding: 0.4rem 1.2rem;
    cursor: pointer;
  }
  .tabs button.active {
    color: var(--color-coal);
    background: var(--color-brass);
    border-color: var(--color-brass);
  }
  /* Utility icons tucked into the top-right corner — findable, not central. */
  .tools {
    position: absolute;
    top: 1.25rem;
    right: 1rem;
    display: flex;
    gap: 0.35rem;
  }
  .tool {
    background: transparent;
    border: 1px solid var(--color-etch);
    border-radius: 6px;
    color: var(--color-dim);
    font-size: 0.9rem;
    padding: 0.35rem 0.55rem;
    cursor: pointer;
  }
  .tool:hover,
  .tool.on {
    color: var(--color-gilt);
    border-color: var(--color-gilt);
  }
  @media (max-width: 640px) {
    .tools {
      position: static;
      justify-content: center;
      margin-top: 0.6rem;
    }
  }
  .data-panel {
    max-width: 42rem;
    margin: 1.25rem auto 0;
    padding: 1.1rem 1.3rem;
    border: 1px solid var(--color-etch);
    border-radius: 10px;
    background: var(--color-panel);
    box-shadow: var(--bevel);
  }
</style>
