import { marked } from "marked";

const source = await Deno.readTextFile("docs/software-guidebook.md");

const renderer = new marked.Renderer();
const defaultCode = renderer.code.bind(renderer);
renderer.code = (token) =>
  token.lang === "mermaid"
    ? `<pre class="mermaid">${token.text}</pre>`
    : defaultCode(token);

const defaultLink = renderer.link.bind(renderer);
// Repository-relative links do not exist on the site; keep the text only.
renderer.link = (token) =>
  /^(https?:|#|mailto:)/.test(token.href)
    ? defaultLink(token)
    : token.text;

const body = marked.parse(source, { renderer, gfm: true }) as string;

const page = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>TigerLegs software guidebook</title>
  <meta name="description" content="Software guidebook of TigerLegs: context, domain model, glossary, design and GPX conventions.">
  <link rel="icon" href="img/tigerlegs-logo.png">
  <style>
    body { font-family: system-ui, sans-serif; line-height: 1.6; color: #1c1917; margin: 0; }
    header { background: #1c1917; padding: 0.75rem 1rem; display: flex; gap: 1.5rem; align-items: center; }
    header nav { display: flex; gap: 1rem; }
    header a { color: #fbbf24; font-weight: 700; text-decoration: none; }
    header nav a { font-weight: 500; }
    header nav a[aria-current] { border-bottom: 2px solid #fbbf24; }
    .intro { background: #fffbeb; border-left: 4px solid #f59e0b; padding: 0.75rem 1rem; }
    main { max-width: 52rem; margin: 0 auto; padding: 1rem 1rem 4rem; }
    h1, h2, h3 { line-height: 1.2; }
    h1 { border-bottom: 4px solid #f59e0b; padding-bottom: 0.25rem; }
    a { color: #b45309; }
    table { border-collapse: collapse; display: block; overflow-x: auto; }
    th, td { border: 1px solid #d6d3d1; padding: 0.25rem 0.5rem; text-align: left; }
    code { background: #f5f5f4; padding: 0 0.2rem; }
    pre { background: #f5f5f4; padding: 0.75rem; overflow-x: auto; }
    pre code { background: none; padding: 0; }
    pre.mermaid { background: none; text-align: center; }
    img { max-width: 100%; }
  </style>
</head>
<body>
  <header>
    <a href="./">TigerLegs</a>
    <nav>
      <a href="./">Extractorrr</a>
      <a href="about.html">About</a>
      <a href="guidebook.html" aria-current="page">Guidebook</a>
    </nav>
  </header>
  <main>
    <p class="intro"><strong>For tech heads.</strong> This guidebook describes how TigerLegs is built: context, domain model, glossary, design and GPX conventions. It is <strong>under construction</strong> and will change. Just want to try the app? Go to the <a href="./">Extractorrr</a>.</p>
${body}
  </main>
  <script type="module">
    import mermaid from "https://cdn.jsdelivr.net/npm/mermaid@11/dist/mermaid.esm.min.mjs";
    mermaid.initialize({ startOnLoad: true });
  </script>
</body>
</html>
`;

await Deno.writeTextFile("public/guidebook.html", page);

await Deno.mkdir("public/diagrams", { recursive: true });
for await (const entry of Deno.readDir("docs/diagrams")) {
  if (entry.name.endsWith(".svg")) {
    await Deno.copyFile(
      `docs/diagrams/${entry.name}`,
      `public/diagrams/${entry.name}`,
    );
  }
}
