<script lang="ts">
  // Self-hosted steampunk type (DESIGN_SYSTEM §1) — $0, fully local.
  import "@fontsource/cinzel/600.css";
  import "@fontsource/spectral/400.css";
  import "@fontsource/spectral/600.css";
  import "@fontsource/jetbrains-mono/400.css";
  import "@fontsource/jetbrains-mono/600.css";
  import "$lib/styles/tokens.css";
  let { children } = $props();
</script>

{@render children()}
