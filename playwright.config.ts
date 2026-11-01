import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./test/site",
  testMatch: "*.spec.ts",
  workers: 1,
  use: { baseURL: "http://127.0.0.1:8784/tigerlegs/" },
  webServer: {
    command: "node test/site/static-server.mjs",
    url: "http://127.0.0.1:8784/tigerlegs/",
    reuseExistingServer: false,
  },
});
