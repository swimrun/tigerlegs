import { defineConfig } from "@playwright/test";
import { defineBddConfig } from "playwright-bdd";

// The acceptance criteria of the issues are Gherkin features (test/features); playwright-bdd turns them into
// Playwright specs (`npm run test:features` runs `bddgen` first). The older site tests stay plain specs.
const featuresDir = defineBddConfig({
  features: "test/features/*.feature",
  steps: "test/features/steps/*.ts",
  outputDir: "test/features/.generated",
});

export default defineConfig({
  workers: 1,
  use: { baseURL: "http://127.0.0.1:8784/tigerlegs/" },
  projects: [
    { name: "site", testDir: "./test/site", testMatch: "*.spec.ts" },
    { name: "features", testDir: featuresDir },
  ],
  webServer: {
    command: "node test/site/static-server.mjs",
    url: "http://127.0.0.1:8784/tigerlegs/",
    reuseExistingServer: false,
  },
});
