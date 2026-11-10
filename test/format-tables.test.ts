import { assertEquals } from "@std/assert";
import { alignTables, splitRow } from "../src/format-tables.ts";

Deno.test("alignTables pads every column to its widest cell and the separator to match", () => {
  const input = "| Option | Weight |\n| --- | --- |\n| Deno with TypeScript | 5 |\n| Go | 15 |";
  assertEquals(
    alignTables(input),
    [
      "| Option               | Weight |",
      "| -------------------- | ------ |",
      "| Deno with TypeScript | 5      |",
      "| Go                   | 15     |",
    ].join("\n"),
  );
});

Deno.test("alignTables is idempotent and leaves text outside tables alone", () => {
  const input = "Intro line.\n\n| A | B |\n| --- | --- |\n| 1 | 22 |\n\nOutro | with a pipe.\n";
  const once = alignTables(input);
  assertEquals(alignTables(once), once);
  assertEquals(once.split("\n")[0], "Intro line.");
  assertEquals(once.split("\n").at(-2), "Outro | with a pipe.");
});

Deno.test("alignTables keeps alignment colons and leaves tables inside code fences untouched", () => {
  assertEquals(alignTables("| A | B |\n| :-- | --: |\n| x | y |").split("\n")[1], "| :-- | --: |");
  const fenced = "```md\n| A | B |\n| --- | --- |\n| 1 | 2 |\n```";
  assertEquals(alignTables(fenced), fenced);
});

Deno.test("splitRow does not split on a pipe in a code span or an escaped pipe", () => {
  assertEquals(splitRow("| `a|b` | c\\|d | e |"), ["`a|b`", "c\\|d", "e"]);
});

Deno.test("alignTables drops empty padding cells beyond the header, but keeps a cell with content", () => {
  assertEquals(alignTables("| A | B |\n| --- | --- |\n| 1 | 2 |  |  |").split("\n")[2], "| 1   | 2   |");
  assertEquals(alignTables("| A | B |\n| --- | --- |\n| 1 | 2 | 3 |").split("\n")[0], "| A   | B   |     |");
});
