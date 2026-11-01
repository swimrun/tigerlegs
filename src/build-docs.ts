import { marked } from "marked";

export function renderDocument(source: string, base = "", isAdr = false): string {
  const renderer = new marked.Renderer();
  const defaultCode = renderer.code.bind(renderer);
  renderer.code = (token) =>
    token.lang === "mermaid"
      ? `<pre class="mermaid">${token.text}</pre>`
      : defaultCode(token);

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
  await Deno.copyFile(
    "assets/swimrun-paddles-laffrey-vertical-2026.png",
    "public/img/swimrun-paddles-laffrey-vertical-2026.png",
  );

  await Deno.mkdir("public/diagrams", { recursive: true });
  for await (const entry of Deno.readDir("docs/diagrams")) {
    if (entry.name.endsWith(".svg")) {
      await Deno.copyFile(
        `docs/diagrams/${entry.name}`,
        `public/diagrams/${entry.name}`,
      );
    }
  }
}
