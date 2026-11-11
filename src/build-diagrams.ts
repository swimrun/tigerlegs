/**
 * PlantUML (and C4-PlantUML) diagrams live as fenced ```plantuml blocks inside the Markdown, so one
 * file holds the text and its diagram and the Markdown preview can draw it. This renders each block
 * to docs/diagrams/<name>.svg, which the site and the repository keep as the pre-rendered picture.
 * Run it with `deno task diagrams` (needs PlantUML and Java on the machine).
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

async function render(source: string): Promise<Uint8Array> {
  const process = new Deno.Command("plantuml", { args: ["-tsvg", "-pipe"], stdin: "piped", stdout: "piped", stderr: "piped" }).spawn();
  const writer = process.stdin.getWriter();
  await writer.write(new TextEncoder().encode(source));
  await writer.close();
  const { code, stdout, stderr } = await process.output();
  if (code !== 0) throw new Error(new TextDecoder().decode(stderr));
  return stdout;
}

if (import.meta.main) {
  let count = 0;
  for await (const entry of Deno.readDir("docs")) {
    if (!entry.isFile || !entry.name.endsWith(".md")) continue;
    for (const block of extractPlantUml(await Deno.readTextFile(`docs/${entry.name}`))) {
      await Deno.writeFile(`docs/diagrams/${block.name}.svg`, await render(block.source));
      count++;
    }
  }
  console.log(`Rendered ${count} PlantUML diagram(s) from the Markdown`);
}
