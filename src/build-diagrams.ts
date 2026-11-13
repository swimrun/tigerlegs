import { spawn } from "node:child_process";
import { readdir, readFile, writeFile } from "node:fs/promises";

/**
 * PlantUML (and C4-PlantUML) diagrams live as fenced ```plantuml blocks inside the Markdown, so one
 * file holds the text and its diagram and the Markdown preview can draw it. This renders each block
 * to docs/diagrams/<name>.svg, which the site and the repository keep as the pre-rendered picture.
 * Run it with `npm run diagrams` (needs PlantUML and Java on the machine).
 */

export interface PlantUmlBlock {
  /** From the line `@startuml <name>`; names the SVG. */
  name: string;
  source: string;
  /** The `title` line, used as the picture's text alternative. */
  title: string;
}

const BLOCK = /```plantuml\n([\s\S]*?)```/g;

export function extractPlantUml(markdown: string): PlantUmlBlock[] {
  return [...markdown.matchAll(BLOCK)].map(([, source]) => {
    const name = source.match(/^@startuml\s+([\w-]+)/m)?.[1];
    if (!name) throw new Error("A plantuml block must start with `@startuml <name>`, which names its SVG");
    return { name, source, title: source.match(/^title\s+(.+)$/m)?.[1] ?? name };
  });
}

async function render(source: string): Promise<Buffer> {
  const child = spawn("plantuml", ["-tsvg", "-pipe"], { stdio: ["pipe", "pipe", "pipe"] });
  const out: Buffer[] = [];
  const err: Buffer[] = [];
  child.stdout.on("data", (chunk: Buffer) => out.push(chunk));
  child.stderr.on("data", (chunk: Buffer) => err.push(chunk));
  const done = new Promise<number | null>((resolve, reject) => {
    child.on("error", reject);
    child.on("close", resolve);
  });
  child.stdin.end(source);
  const code = await done;
  if (code !== 0) throw new Error(Buffer.concat(err).toString("utf8"));
  return Buffer.concat(out);
}

if (import.meta.main) {
  let count = 0;
  for (const entry of await readdir("docs", { withFileTypes: true })) {
    if (!entry.isFile() || !entry.name.endsWith(".md")) continue;
    for (const block of extractPlantUml(await readFile(`docs/${entry.name}`, "utf8"))) {
      await writeFile(`docs/diagrams/${block.name}.svg`, await render(block.source));
      count++;
    }
  }
  console.log(`Rendered ${count} PlantUML diagram(s) from the Markdown`);
}
