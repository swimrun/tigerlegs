import { expect, it } from "vitest";
import { readdirSync, readFileSync } from "node:fs";

/**
 * The rule: texts for the interface live in external per-language files and never inline in a component or a module:
 * ICU messages in `src/data/<feature>.<lang>.json` for the features on i18next (ADR-0017, issue #84), and for the
 * others `<owner>.strings.<lang>.ts` next to the module that owns them. This test finds inline dictionaries and
 * strings files that miss a language.
 */
const LANGS = ["en", "nl", "fr", "de"];

function sources(dir: string): string[] {
  const files: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = `${dir}/${entry.name}`;
    if (entry.isDirectory()) files.push(...sources(path));
    else if (/\.(ts|tsx|astro)$/.test(entry.name)) files.push(path);
  }
  return files;
}

const files = sources("src");
const isTest = (path: string) => /\.test\.ts$|\.stories\.tsx$/.test(path);
const isStrings = (path: string) => /\.strings(\.[a-z]{2})?\.ts$/.test(path);

it("no component or module holds a translation dictionary of its own", () => {
  const inline = files
    .filter((path) => !isTest(path) && !isStrings(path) && path !== "src/client/language.ts")
    .filter((path) => /Record<Lang,|Partial<Record<Lang,/.test(readFileSync(path, "utf8")));
  expect(inline.length === 0, `Move the texts of ${inline.join(", ")} to <owner>.strings.<lang>.ts files`).toBeTruthy();
});

it("every strings file has all four languages", () => {
  const owners = new Set(files.filter((path) => /\.strings\.[a-z]{2}\.ts$/.test(path)).map((path) => path.replace(/\.[a-z]{2}\.ts$/, "")));
  expect(owners.size > 0).toBeTruthy();
  for (const owner of owners) {
    for (const lang of LANGS) expect(files.includes(`${owner}.${lang}.ts`), `${owner}.${lang}.ts is missing`).toBeTruthy();
    expect(files.includes(`${owner}.ts`), `${owner}.ts, with the Strings type, is missing`).toBeTruthy();
  }
});
