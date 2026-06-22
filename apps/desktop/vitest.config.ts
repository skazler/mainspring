import { defineConfig } from "vitest/config";

// Pure-logic unit tests (gauge math, formatting). Kept separate from the
// SvelteKit vite config so it doesn't pull in the kit plugin.
export default defineConfig({
  test: {
    include: ["src/**/*.test.ts"],
    environment: "node",
  },
});
