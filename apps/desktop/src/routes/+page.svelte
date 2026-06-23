<script lang="ts">
  import { onMount } from "svelte";
  import DialConsole from "$lib/components/DialConsole.svelte";
  import Holdings from "$lib/components/Holdings.svelte";
  import Setup from "$lib/components/Setup.svelte";
  import { initSession, session } from "$lib/stores/session.svelte";

  onMount(() => {
    void initSession();
  });
</script>

{#if !session.loaded}
  <p class="loading">Winding up…</p>
{:else if session.configured}
  <nav class="tabs">
    <button class:active={session.tab === "plan"} onclick={() => (session.tab = "plan")}>Plan</button>
    <button class:active={session.tab === "holdings"} onclick={() => (session.tab = "holdings")}>Holdings</button>
  </nav>
  {#if session.tab === "plan"}
    <DialConsole />
  {:else}
    <Holdings />
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
  .tabs {
    display: flex;
    justify-content: center;
    gap: 0.5rem;
    padding: 1.25rem 0 0;
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
</style>
