<script lang="ts">
  import { onMount } from "svelte";
  import DialConsole from "$lib/components/DialConsole.svelte";
  import Setup from "$lib/components/Setup.svelte";
  import { initSession, session } from "$lib/stores/session.svelte";

  onMount(() => {
    void initSession();
  });
</script>

{#if !session.loaded}
  <p class="loading">Winding up…</p>
{:else if session.configured}
  <DialConsole />
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
</style>
