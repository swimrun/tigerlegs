import { readFile, writeFile } from "node:fs/promises";
/**
 * Numbers the section headings of a Markdown document: `## 3. Title` for a section and `### 3.2 Title` for a
 * subsection, counted in order, so that a reader can refer to "section 3.2". The title line (`#`) and headings
 * inside code fences are left alone. The back matter is not numbered: the headings in UNNUMBERED, and every
 * subsection below them (such as `### Appendix A: Glossary`). Run `npm run headings <file>`; a second run
 * changes nothing.
 */
export const UNNUMBERED: ReadonlySet<string> = new Set(["Reading guide", "References", "Appendices"]);

/** An existing number: `1.`, `2.1` or `2.1.`, but not a year like `2026 plan`. */
const NUMBER = /^\d+\.(?:\d+\.?)*\s+/;

export function numberHeadings(markdown: string): string {
  let fenced = false;
  let section = 0;
  let subsection = 0;
  let back = false;
  return markdown.split("\n").map((line) => {
    if (/^(```|~~~)/.test(line)) {
      fenced = !fenced;
      return line;
    }
    if (fenced) return line;
    const heading = line.match(/^(#{2,3}) (.*)$/);
    if (!heading) return line;
    const text = heading[2].replace(NUMBER, "");
    if (heading[1] === "##") {
      back = UNNUMBERED.has(text);
      if (back) return `## ${text}`;
      section++;
      subsection = 0;
      return `## ${section}. ${text}`;
    }
    if (back) return `### ${text}`;
    subsection++;
    return `### ${section}.${subsection} ${text}`;
  }).join("\n");
}

if (import.meta.main) {
  for (const file of process.argv.slice(2)) {
    const before = await readFile(file, "utf8");
    const after = numberHeadings(before);
    if (after !== before) await writeFile(file, after);
    console.log(`${after === before ? "unchanged" : "numbered"}: ${file}`);
  }
}
