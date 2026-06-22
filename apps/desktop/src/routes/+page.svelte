<script lang="ts">
  import DialConsole from "$lib/components/DialConsole.svelte";
  import Setup from "$lib/components/Setup.svelte";
  import { session } from "$lib/stores/session.svelte";
</script>

{#if session.configured}
  <DialConsole />
{:else}
  <Setup />
{/if}
