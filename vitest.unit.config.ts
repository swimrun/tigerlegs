import { defineConfig } from "vitest/config";

// The unit tests of the logic (src and test): plain tests in a Node environment, run with `npm test`.
// The Storybook tests (vitest.config.ts), the server tests (vitest.server.config.ts) and the Playwright
// site tests (test/site) have their own configurations.
export default defineConfig({
  test: {
    name: "unit",
    environment: "node",
    include: ["src/**/*.test.ts", "test/**/*.test.ts"],
    exclude: ["test/site/**", "node_modules/**"],
  },
});
