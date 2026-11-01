import type { Preview } from "@storybook/react-vite";
import "../src/client/styles.css";

const preview: Preview = {
  parameters: {
    // "error" fails the Vitest run on any axe violation; "todo" would only show it in the panel.
    a11y: { test: "error" },
    layout: "padded",
  },
};

export default preview;
