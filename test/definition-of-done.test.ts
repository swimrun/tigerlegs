import { readFileSync } from "node:fs";
import { expect, it } from "vitest";

/** The bold titles of the checklist items, in order: "**Tests.**" gives "Tests". */
function titles(path: string): string[] {
  const checklist = readFileSync(path, "utf8").split(/^## (?:Checklist|Definition of Done)$/m)[1] ?? "";
  return [...checklist.matchAll(/^- \[ \] \*\*([^*]+?)\.?\*\*/gm)].map((match) => match[1]);
}

const document = titles("docs/DEFINITION_OF_DONE.md");

it("the Definition of Done document has its checklist", () => {
  expect(document.length).toBeGreaterThan(5);
});

it("the issue template carries every item of the Definition of Done, in order", () => {
  expect(titles(".github/ISSUE_TEMPLATE/user-story.md")).toEqual(document);
});

it("the pull request template carries every item of the Definition of Done, in order", () => {
  expect(titles(".github/pull_request_template.md")).toEqual(document);
});
