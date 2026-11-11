import { expect, it } from "vitest";
import { readdirSync, readFileSync } from "node:fs";
import { numberHeadings } from "../src/number-headings.ts";

it("numberHeadings numbers sections and subsections in order and leaves the title alone", () => {
  const input = "# 14. Title\n\n## Status\n\n## Context\n\n### First\n\n### Second\n\n## Method\n\n### Third";
  expect(numberHeadings(input)).toEqual("# 14. Title\n\n## 1. Status\n\n## 2. Context\n\n### 2.1 First\n\n### 2.2 Second\n\n## 3. Method\n\n### 3.1 Third");
});

it("numberHeadings renumbers existing numbers and a second run changes nothing", () => {
  const input = "## 5. Old\n\n### 5.9 Gap\n\n## 7. Skipped\n\n### 7.4 Other";
  const once = numberHeadings(input);
  expect(once).toEqual("## 1. Old\n\n### 1.1 Gap\n\n## 2. Skipped\n\n### 2.1 Other");
  expect(numberHeadings(once)).toEqual(once);
});

it("numberHeadings does not strip a year from a heading", () => {
  expect(numberHeadings("## 2026 plan")).toEqual("## 1. 2026 plan");
});

it("numberHeadings skips code fences and does not number the back matter", () => {
  const input = "## Body\n\n```md\n## not a heading\n```\n\n## References\n\n### Sub of references\n\n## Appendices\n\n### Appendix A: Glossary";
  expect(numberHeadings(input)).toEqual("## 1. Body\n\n```md\n## not a heading\n```\n\n## References\n\n### Sub of references\n\n## Appendices\n\n### Appendix A: Glossary");
});

it("the architecture decision records, the software guidebook and the README have numbered headings", () => {
  const files = [
    "docs/software-guidebook.md",
    "README.md",
    ...readdirSync("docs/adr").filter((name) => /^\d{4}-.*\.md$/.test(name)).map((name) => `docs/adr/${name}`),
  ];
  expect(files.length > 10).toBeTruthy();
  for (const file of files) {
    const text = readFileSync(file, "utf8");
    expect(numberHeadings(text), `${file}: run deno task headings ${file}`).toEqual(text);
  }
});
