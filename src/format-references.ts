/**
 * Writes the reference list of a document as a bullet list: one bullet per source, without a blank
 * line between sources. APA puts a blank line between references; bullets keep the Markdown source
 * short and are still read as a list. `deno task refs <file...>` converts the `## References`
 * section of the files in place; a section that is a list already stays as it is.
 */
export function bulletReferences(markdown: string): string {
  const lines = markdown.split("\n");
  const start = lines.findIndex((line) => /^## References\s*$/.test(line));
  if (start === -1) return markdown;
  let end = lines.findIndex((line, i) => i > start && /^#{1,2} /.test(line));
  if (end === -1) end = lines.length;

  const body = lines.slice(start + 1, end);
  const paragraphs: string[][] = [];
  let current: string[] = [];
  for (const line of body) {
    if (line.trim() === "") {
      if (current.length) paragraphs.push(current);
      current = [];
    } else {
      current.push(line);
    }
  }
  if (current.length) paragraphs.push(current);

  const bullets = paragraphs.flatMap((paragraph) => {
    if (paragraph[0].startsWith("- ")) return [paragraph.join("\n")]; // a list already
    return [`- ${paragraph.map((line, i) => (i === 0 ? line : `  ${line.trim()}`)).join("\n")}`];
  });
  // A section in the middle of a file keeps a blank line before the next heading; at the end of a file,
  // the original final newline stays.
  const trailing = end < lines.length || markdown.endsWith("\n") ? [""] : [];
  return [...lines.slice(0, start + 1), "", ...bullets.join("\n").split("\n"), ...trailing, ...lines.slice(end)].join("\n");
}

if (import.meta.main) {
  for (const file of Deno.args) {
    const before = await Deno.readTextFile(file);
    const after = bulletReferences(before);
    if (after !== before) await Deno.writeTextFile(file, after);
    console.log(`${after === before ? "unchanged" : "converted"}: ${file}`);
  }
}
