import { assertEquals, assertStringIncludes } from "@std/assert";
import { renderDocument } from "../src/build-docs.ts";

Deno.test("guidebook pair image resolves on Pages and remains linked in Markdown", async () => {
  const source = await Deno.readTextFile("docs/software-guidebook.md");
  assertStringIncludes(source, "(../public/img/tigerlegs-pair.jpg)");
  const html = renderDocument(source);
  assertStringIncludes(html, 'src="img/tigerlegs-pair.jpg"');
  assertStringIncludes(html, "one runs into the lake");
  assertStringIncludes(
    html,
    'src="img/swimrun-paddles-laffrey-vertical-2026.png"',
  );
  const image = await Deno.stat("public/img/tigerlegs-pair.jpg");
  assertEquals(image.isFile && image.size > 0, true);
  assertStringIncludes(
    renderDocument("![Context](diagrams/context.svg)"),
    'src="diagrams/context.svg"',
  );
});

Deno.test("guidebook chapters have stable, unique anchors and keep fragment links", () => {
  const html = renderDocument(
    "# Guidebook\n\n## 1. Context\n\n[Context](#1-context)\n\n## 1. Context\n\n## 2. Functional overview",
  );
  assertStringIncludes(html, '<h2 id="1-context">');
  assertStringIncludes(html, '<h2 id="1-context-2">');
  assertStringIncludes(html, '<h2 id="2-functional-overview">');
  assertStringIncludes(html, 'href="#1-context"');
});

Deno.test("guidebook and ADR links point at static deployed routes under the base path", () => {
  assertStringIncludes(
    renderDocument("[Astro](./adr/0008-astro-static-site-with-react-islands.md)", "/tigerlegs/"),
    'href="/tigerlegs/adr/0008-astro-static-site-with-react-islands.html"',
  );
  assertStringIncludes(
    renderDocument("[React](./0009-react-for-interactive-frontend.md)", "/tigerlegs/", true),
    'href="/tigerlegs/adr/0009-react-for-interactive-frontend.html"',
  );
});
