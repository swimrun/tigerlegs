/**
 * Pads the columns of Markdown tables with spaces so that a table reads as a table in the source,
 * without a preview. `deno task tables <file...>` rewrites the files in place; it leaves everything
 * outside tables (and tables inside code fences) alone, and a second run changes nothing.
 */

/** Splits a table row into trimmed cells; a pipe in a code span or after a backslash is not a separator. */
export function splitRow(line: string): string[] {
  const cells: string[] = [];
  let current = "";
  let inCode = false;
  const text = line.trim().replace(/^\|/, "").replace(/(?<!\\)\|$/, "");
  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    if (char === "\\" && text[i + 1] === "|") {
      current += "\\|";
      i++;
    } else if (char === "`") {
      inCode = !inCode;
      current += char;
    } else if (char === "|" && !inCode) {
      cells.push(current.trim());
      current = "";
    } else {
      current += char;
    }
  }
  cells.push(current.trim());
  return cells;
}

const isSeparator = (cells: string[]) => cells.length > 0 && cells.every((cell) => /^:?-+:?$/.test(cell));

function alignTable(rows: string[][]): string[] {
  const columns = Math.max(...rows.map((row) => row.length));
  const widths = Array.from({ length: columns }, (_, column) =>
    Math.max(3, ...rows.filter((row) => !isSeparator(row)).map((row) => [...(row[column] ?? "")].length)));
  return rows.map((row) => {
    const cells = widths.map((width, column) => {
      const cell = row[column] ?? "";
      if (isSeparator(row)) {
        const left = cell.startsWith(":") ? ":" : "";
        const right = cell.endsWith(":") && cell.length > 1 ? ":" : "";
        return left + "-".repeat(width - left.length - right.length) + right;
      }
      return cell + " ".repeat(width - [...cell].length);
    });
    return `| ${cells.join(" | ")} |`;
  });
}

export function alignTables(markdown: string): string {
  const lines = markdown.split("\n");
  const out: string[] = [];
  let inFence = false;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (/^\s*(```|~~~)/.test(line)) inFence = !inFence;
    if (inFence || !line.trimStart().startsWith("|")) {
      out.push(line);
      continue;
    }
    const start = i;
    while (i + 1 < lines.length && lines[i + 1].trimStart().startsWith("|")) i++;
    const rows = lines.slice(start, i + 1).map(splitRow);
    out.push(...(rows.length >= 2 && isSeparator(rows[1]) ? alignTable(rows) : lines.slice(start, i + 1)));
  }
  return out.join("\n");
}

if (import.meta.main) {
  for (const file of Deno.args) {
    const before = await Deno.readTextFile(file);
    const after = alignTables(before);
    if (after !== before) await Deno.writeTextFile(file, after);
    console.log(`${after === before ? "unchanged" : "aligned"}: ${file}`);
  }
}
