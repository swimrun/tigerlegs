import { assertEquals, assertStringIncludes, assertThrows } from "@std/assert";
import { extractPlantUml } from "../src/build-diagrams.ts";
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

Deno.test("a PlantUML block in the Markdown becomes its pre-rendered picture and keeps its source", () => {
  const html = renderDocument("```plantuml\n@startuml demo-diagram\ntitle A demo\nAlice -> Bob\n@enduml\n```", "/tigerlegs");
  assertStringIncludes(html, '<img src="/tigerlegs/diagrams/demo-diagram.svg" alt="A demo">');
  assertStringIncludes(html, "<summary>PlantUML source</summary>");
  assertStringIncludes(html, "Alice -&gt; Bob");
});

Deno.test("every PlantUML block in the docs has its rendered SVG, so none is forgotten when it changes", async () => {
  for await (const entry of Deno.readDir("docs")) {
    if (!entry.isFile || !entry.name.endsWith(".md")) continue;
    for (const block of extractPlantUml(await Deno.readTextFile(`docs/${entry.name}`))) {
      const svg = await Deno.readTextFile(`docs/diagrams/${block.name}.svg`);
      assertStringIncludes(svg, "<svg", `${entry.name}: ${block.name}.svg is not an SVG`);
    }
  }
});

Deno.test("extractPlantUml names a block by its @startuml line and refuses an unnamed one", () => {
  assertEquals(extractPlantUml("x\n```plantuml\n@startuml a-b\ntitle T\n@enduml\n```\n").map((b) => [b.name, b.title]), [["a-b", "T"]]);
  assertThrows(() => extractPlantUml("```plantuml\n@startuml\n@enduml\n```"), Error, "@startuml <name>");
});
