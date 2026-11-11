import { expect, it } from "vitest";
import { alignTables, splitRow } from "../src/format-tables.ts";

it("alignTables pads every column to its widest cell and the separator to match", () => {
  const input = "| Option | Weight |\n| --- | --- |\n| Deno with TypeScript | 5 |\n| Go | 15 |";
  expect(alignTables(input)).toEqual([
      "| Option               | Weight |",
      "| -------------------- | ------ |",
      "| Deno with TypeScript | 5      |",
      "| Go                   | 15     |",
    ].join("\n"));
});

it("alignTables is idempotent and leaves text outside tables alone", () => {
  const input = "Intro line.\n\n| A | B |\n| --- | --- |\n| 1 | 22 |\n\nOutro | with a pipe.\n";
  const once = alignTables(input);
  expect(alignTables(once)).toEqual(once);
  expect(once.split("\n")[0]).toEqual("Intro line.");
  expect(once.split("\n").at(-2)).toEqual("Outro | with a pipe.");
});

it("alignTables keeps alignment colons and leaves tables inside code fences untouched", () => {
  expect(alignTables("| A | B |\n| :-- | --: |\n| x | y |").split("\n")[1]).toEqual("| :-- | --: |");
  const fenced = "```md\n| A | B |\n| --- | --- |\n| 1 | 2 |\n```";
  expect(alignTables(fenced)).toEqual(fenced);
});

it("splitRow does not split on a pipe in a code span or an escaped pipe", () => {
  expect(splitRow("| `a|b` | c\\|d | e |")).toEqual(["`a|b`", "c\\|d", "e"]);
});

it("alignTables drops empty padding cells beyond the header, but keeps a cell with content", () => {
  expect(alignTables("| A | B |\n| --- | --- |\n| 1 | 2 |  |  |").split("\n")[2]).toEqual("| 1   | 2   |");
  expect(alignTables("| A | B |\n| --- | --- |\n| 1 | 2 | 3 |").split("\n")[0]).toEqual("| A   | B   |     |");
});
