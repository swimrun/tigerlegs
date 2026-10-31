import { marked } from "marked";
import denoConfig from "../deno.json" with { type: "json" };

export function renderGuidebook(source: string): string {
  const renderer = new marked.Renderer();
  const defaultCode = renderer.code.bind(renderer);
  renderer.code = (token) =>
    token.lang === "mermaid"
      ? `<pre class="mermaid">${token.text}</pre>`
      : defaultCode(token);

  const defaultLink = renderer.link.bind(renderer);
  // Repository-relative links do not exist on the site; keep the text only.
  renderer.link = (token) =>
    /^(https?:|#|mailto:)/.test(token.href) ? defaultLink(token) : token.text;

  const defaultImage = renderer.image.bind(renderer);
  renderer.image = (token) =>
    defaultImage({
      ...token,
      href: token.href.replace(/^\.\.\/public\//, "")
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

  const body = marked.parse(source, { renderer, gfm: true }) as string;

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>TigerLegs software guidebook</title>
  <meta name="description" content="Software guidebook of TigerLegs: context, domain model, glossary, design and GPX conventions.">
  <link rel="icon" type="image/png" sizes="32x32" href="favicon-32.png">
  <link rel="stylesheet" href="styles.css">
</head>
<body class="min-h-screen bg-stone-50 text-stone-800 antialiased">
  <header class="site-header">
    <div class="site-header-inner">
      <a href="./" class="site-brand"><img src="img/tigerlegs-logo-web.png" alt="TigerLegs logo"></a>
      <div class="site-header-tools">
        <span class="rounded bg-stone-950 px-2 py-0.5 text-xs font-semibold uppercase tracking-wider text-amber-400">Beta</span>
        <span id="app-version" class="text-xs text-stone-700">v${denoConfig.version}</span>
        <nav id="main-menu" aria-label="Main menu" class="site-menu">
          <a href="./">Extractorrr</a>
          <a href="about.html">About</a>
          <a href="guidebook.html" aria-current="page">Guidebook</a>
        </nav>
      </div>
    </div>
    <div class="site-tagline"><img src="img/tigerlegs-acronym-anim-dark.svg" alt="TIGERLEGS: Terrain Informed Gpx ExtractoR: LEts Go Swimrun!"></div>
    <div class="tiger-stripes"></div>
  </header>
  <main class="guidebook">
    <p class="rounded border-l-4 border-amber-500 bg-amber-50 p-4"><strong>For tech heads.</strong> This guidebook describes how TigerLegs is built: context, domain model, glossary, design and GPX conventions. It is <strong>under construction</strong> and will change. Just want to try the app? Go to the <a href="./">Extractorrr</a>.</p>
${body}
  </main>
  <footer class="mx-auto max-w-3xl px-4 pb-8 text-xs text-stone-600">
    &copy; 2026 IT Off the Wall BV · <a class="underline" href="about.html">About</a>
    · <a class="underline" href="guidebook.html">Guidebook</a>
  </footer>
  <script type="module">
    import mermaid from "https://cdn.jsdelivr.net/npm/mermaid@11/dist/mermaid.esm.min.mjs";
    mermaid.initialize({ startOnLoad: true });
  </script>
</body>
</html>
`;
}

if (import.meta.main) {
  const source = await Deno.readTextFile("docs/software-guidebook.md");
  const page = renderGuidebook(source);
  await Deno.writeTextFile("public/guidebook.html", page);
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
