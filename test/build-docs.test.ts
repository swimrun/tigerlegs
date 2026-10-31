import { assertEquals, assertMatch, assertStringIncludes } from "@std/assert";
import { DOMParser } from "@xmldom/xmldom";
import { renderGuidebook } from "../src/build-docs.ts";

function menu(html: string) {
  const doc = new DOMParser().parseFromString(html, "text/html");
  const nav = Array.from(doc.getElementsByTagName("nav"))
    .find((element) => element.getAttribute("aria-label") === "Main menu")!;
  return Array.from(nav.getElementsByTagName("a")).map((link) => ({
    text: link.textContent,
    href: link.getAttribute("href"),
    current: link.getAttribute("aria-current") === "page",
  }));
}

Deno.test("site pages share navigation and styling with the correct active page", async () => {
  const pages = [
    await Deno.readTextFile("public/index.html"),
    await Deno.readTextFile("public/about.html"),
    renderGuidebook("# Guidebook"),
  ];
  const expected = [
    { text: "Extractorrr", href: "./" },
    { text: "About", href: "about.html" },
    { text: "Guidebook", href: "guidebook.html" },
  ];
  for (const [index, page] of pages.entries()) {
    assertEquals(
      menu(page),
      expected.map((link, i) => ({
        ...link,
        current: index === i,
      })),
    );
    assertStringIncludes(page, 'class="site-header"');
    assertStringIncludes(page, 'class="site-header-inner"');
    assertStringIncludes(page, 'class="site-menu"');
    assertStringIncludes(page, 'href="styles.css"');
    const doc = new DOMParser().parseFromString(page, "text/html");
    const tagline = Array.from(doc.getElementsByTagName("div"))
      .find((element) => element.getAttribute("class") === "site-tagline")!;
    assertEquals(tagline.parentNode?.nodeName, "header");
    const image = tagline.getElementsByTagName("img")[0];
    assertMatch(
      image?.getAttribute("alt") ?? tagline.textContent ?? "",
      /Terrain[- ]Informed Gpx Extractor: LEts Go Swimrun!/i,
    );
  }
});

Deno.test("guidebook pair image resolves on Pages and remains linked in Markdown", async () => {
  const source = await Deno.readTextFile("docs/software-guidebook.md");
  assertStringIncludes(source, "(../public/img/tigerlegs-pair.jpg)");
  const html = renderGuidebook(source);
  assertStringIncludes(html, 'src="img/tigerlegs-pair.jpg"');
  assertStringIncludes(html, "one runs into the lake");
  assertStringIncludes(
    html,
    'src="img/swimrun-paddles-laffrey-vertical-2026.png"',
  );
  const image = await Deno.stat("public/img/tigerlegs-pair.jpg");
  assertEquals(image.isFile && image.size > 0, true);
  assertStringIncludes(
    renderGuidebook("![Context](diagrams/context.svg)"),
    'src="diagrams/context.svg"',
  );
});

Deno.test("guidebook chapters have stable, unique anchors and keep fragment links", () => {
  const html = renderGuidebook(
    "# Guidebook\n\n## 1. Context\n\n[Context](#1-context)\n\n## 1. Context\n\n## 2. Functional overview",
  );
  assertStringIncludes(html, '<h2 id="1-context">');
  assertStringIncludes(html, '<h2 id="1-context-2">');
  assertStringIncludes(html, '<h2 id="2-functional-overview">');
  assertStringIncludes(html, 'href="#1-context"');
});
