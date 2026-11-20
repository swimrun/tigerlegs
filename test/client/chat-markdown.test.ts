import { expect, it } from "vitest";
import { isSafeHref, parseInline } from "../../src/client/chat-markdown.ts";

it("splits a sentence into text and code", () => {
  expect(parseInline("The command `npm test` runs the unit tests.")).toEqual([
    { kind: "text", text: "The command " },
    { kind: "code", text: "npm test" },
    { kind: "text", text: " runs the unit tests." },
  ]);
});

it("reads bold, italic and a link", () => {
  expect(parseInline("**a** *b* [c](https://example.com/x)")).toEqual([
    { kind: "strong", text: "a" },
    { kind: "text", text: " " },
    { kind: "em", text: "b" },
    { kind: "text", text: " " },
    { kind: "link", text: "c", href: "https://example.com/x" },
  ]);
});

it("keeps text without Markdown as one piece", () => {
  expect(parseInline("plain 2 * 3 text")).toEqual([{ kind: "text", text: "plain 2 * 3 text" }]);
});

it("never makes a link of an unsafe address, and leaves a script tag as text", () => {
  for (const href of ["javascript:alert(1)", "JAVASCRIPT:alert(1)", "data:text/html,x", "//evil.example/x", "vbscript:x"]) {
    expect(isSafeHref(href)).toEqual(false);
    expect(parseInline(`[click](${href})`).some((piece) => piece.kind === "link")).toEqual(false);
  }
  expect(parseInline("<script>alert(1)</script>")).toEqual([{ kind: "text", text: "<script>alert(1)</script>" }]);
});

it("allows http(s) and paths on this site", () => {
  for (const href of ["https://a.example", "http://a.example", "/tigerlegs/about.html", "./about.html", "../x", "#section"]) expect(isSafeHref(href)).toEqual(true);
});

it("shows code literally, without reading Markdown inside it", () => {
  expect(parseInline("`**x**`")).toEqual([{ kind: "code", text: "**x**" }]);
});
