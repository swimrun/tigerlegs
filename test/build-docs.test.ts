import { expect, it } from "vitest";
import { readdir, readFile, stat } from "node:fs/promises";
import { extractPlantUml } from "../src/build-diagrams.ts";
import { renderDocument } from "../src/build-docs.ts";

it("guidebook pair image resolves on Pages and remains linked in Markdown", async () => {
  const source = await readFile("docs/software-guidebook.md", "utf8");
  expect(source).toContain("(../public/img/tigerlegs-pair.jpg)");
  const html = renderDocument(source);
  expect(html).toContain('src="img/tigerlegs-pair.jpg"');
  expect(html).toContain("one runs into the lake");
  expect(html).toContain('src="img/swimrun-paddles-laffrey-vertical-2026.png"');
  const image = await stat("public/img/tigerlegs-pair.jpg");
  expect(image.isFile() && image.size > 0).toEqual(true);
  expect(renderDocument("![Context](diagrams/context.svg)")).toContain('src="diagrams/context.svg"');
});

it("guidebook chapters have stable, unique anchors and keep fragment links", () => {
  const html = renderDocument(
    "# Guidebook\n\n## 1. Context\n\n[Context](#1-context)\n\n## 1. Context\n\n## 2. Functional overview",
  );
  expect(html).toContain('<h2 id="1-context">');
  expect(html).toContain('<h2 id="1-context-2">');
  expect(html).toContain('<h2 id="2-functional-overview">');
  expect(html).toContain('href="#1-context"');
});

it("guidebook and ADR links point at static deployed routes under the base path", () => {
  expect(renderDocument("[Astro](./adr/0008-astro-static-site-with-react-islands.md)", "/tigerlegs/")).toContain('href="/tigerlegs/adr/0008-astro-static-site-with-react-islands.html"');
  expect(renderDocument("[React](./0009-react-for-interactive-frontend.md)", "/tigerlegs/", true)).toContain('href="/tigerlegs/adr/0009-react-for-interactive-frontend.html"');
});

it("a PlantUML block in the Markdown becomes its pre-rendered picture and keeps its source", () => {
  const html = renderDocument("```plantuml\n@startuml demo-diagram\ntitle A demo\nAlice -> Bob\n@enduml\n```", "/tigerlegs");
  expect(html).toContain('<img src="/tigerlegs/diagrams/demo-diagram.svg" alt="A demo">');
  expect(html).toContain("<summary>PlantUML source</summary>");
  expect(html).toContain("Alice -&gt; Bob");
});

it("every PlantUML block in the docs has its rendered SVG, so none is forgotten when it changes", async () => {
  for (const entry of await readdir("docs", { withFileTypes: true })) {
    if (!entry.isFile() || !entry.name.endsWith(".md")) continue;
    for (const block of extractPlantUml(await readFile(`docs/${entry.name}`, "utf8"))) {
      const svg = await readFile(`docs/diagrams/${block.name}.svg`, "utf8");
      expect(svg).toContain("<svg");
    }
  }
});

it("extractPlantUml names a block by its @startuml line and refuses an unnamed one", () => {
  expect(extractPlantUml("x\n```plantuml\n@startuml a-b\ntitle T\n@enduml\n```\n").map((b) => [b.name, b.title])).toEqual([["a-b", "T"]]);
  expect(() => extractPlantUml("```plantuml\n@startuml\n@enduml\n```")).toThrow(Error);
expect(() => extractPlantUml("```plantuml\n@startuml\n@enduml\n```")).toThrow("@startuml <name>");
});
