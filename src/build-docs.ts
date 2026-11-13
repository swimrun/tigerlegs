import { copyFile, mkdir, readdir } from "node:fs/promises";
import { marked } from "marked";
import { extractPlantUml } from "./build-diagrams.ts";

export function renderDocument(source: string, base = "", isAdr = false): string {
  const renderer = new marked.Renderer();
  const defaultCode = renderer.code.bind(renderer);
  const root0 = base ? base.replace(/\/?$/, "/") : "";
  renderer.code = (token) => {
    if (token.lang === "mermaid") return `<pre class="mermaid">${token.text}</pre>`;
    if (token.lang === "plantuml") {
      // The picture is rendered from this block by `npm run diagrams`; the source stays readable.
      const [block] = extractPlantUml("```plantuml\n" + token.text + "\n```");
      const alt = block.title.replace(/"/g, "&quot;");
      return `<figure><img src="${root0}diagrams/${block.name}.svg" alt="${alt}">` +
        `<details><summary>PlantUML source</summary>${defaultCode(token)}</details></figure>`;
    }
    return defaultCode(token);
  };

  const defaultLink = renderer.link.bind(renderer);
  const root = base ? base.replace(/\/?$/, "/") : "";
  renderer.link = (token) => {
    if (/^(https?:|#|mailto:)/.test(token.href)) return defaultLink(token);
    const adr = token.href.match(isAdr ? /^\.\/(\d{4}-[^#]*?)\.md(#.*)?$/ : /^\.\/adr\/([^#]*?)\.md(#.*)?$/);
    if (adr) return defaultLink({ ...token, href: `${root}adr/${adr[1]}.html${adr[2] ?? ""}` });
    if (token.href === "./adr/") return defaultLink({ ...token, href: `${root}guidebook.html#13-decision-log` });
    return defaultLink({ ...token, href: `https://github.com/swimrun/tigerlegs/blob/main/${isAdr ? "docs/adr/" : "docs/"}${token.href}` });
  };

  const defaultImage = renderer.image.bind(renderer);
  renderer.image = (token) =>
    defaultImage({
      ...token,
      href: /^(https?:|data:)/.test(token.href) ? token.href :
        root + token.href.replace(/^\.\.\/public\//, "")
          .replace(/^\.\.\/assets\//, "img/"),
    });

  const headingIds = new Map<string, number>();
  const usedHeadingIds = new Set<string>();
  const defaultHeading = renderer.heading.bind(renderer);
  renderer.heading = (token) => {
    const slug = token.text.toLowerCase().replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "") || "section";
    let count = (headingIds.get(slug) ?? 0) + 1;
    let id = count === 1 ? slug : `${slug}-${count}`;
    while (usedHeadingIds.has(id)) {
      count++;
      id = `${slug}-${count}`;
    }
    headingIds.set(slug, count);
    usedHeadingIds.add(id);
    return defaultHeading(token).replace(
      `<h${token.depth}>`,
      `<h${token.depth} id="${id}">`,
    );
  };

  return marked.parse(source, { renderer, gfm: true }) as string;
}

if (import.meta.main) {
  await copyFile(
    "assets/swimrun-paddles-laffrey-vertical-2026.png",
    "public/img/swimrun-paddles-laffrey-vertical-2026.png",
  );

  await mkdir("public/diagrams", { recursive: true });
  for (const name of await readdir("docs/diagrams")) {
    if (name.endsWith(".svg")) {
      await copyFile(`docs/diagrams/${name}`, `public/diagrams/${name}`);
    }
  }
}
