import { defineConfig } from "astro/config";
import react from "@astrojs/react";

export default defineConfig({
  site: "https://swimrun.group",
  base: "/tigerlegs",
  output: "static",
  build: { format: "file" },
  integrations: [react()],
});
