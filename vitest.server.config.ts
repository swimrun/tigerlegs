import { defineConfig } from "vitest/config";

// The Node.js back end (src/server): plain unit tests in a Node environment, run with `npm run test:server`.
export default defineConfig({
  test: {
    name: "server",
    environment: "node",
    include: ["src/server/**/*.test.ts"],
  },
});
