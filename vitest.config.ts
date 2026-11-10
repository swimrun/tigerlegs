import { defineConfig } from "vitest/config";
import { storybookTest } from "@storybook/addon-vitest/vitest-plugin";
import { playwright } from "@vitest/browser-playwright";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  plugins: [tailwindcss(), storybookTest({ configDir: ".storybook" })],
  test: {
    name: "storybook",
    browser: { enabled: true, headless: true, provider: playwright(), instances: [{ browser: "chromium" }] },
  },
});
