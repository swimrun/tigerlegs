import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { expect, it } from "vitest";
import GenUi from "../../src/components/GenUi.tsx";
import { STRINGS } from "../../src/components/GenUi.strings.ts";
import { LANGS, type Lang } from "../../src/client/language.ts";

const proposal = {
  component: "ChangeProposal",
  props: { title: "Proposed moves", changes: [{ label: "Tuesday", before: "Run 8 km", after: "Swim 2 km" }] },
};

const render = (description: unknown, lang: Lang = "en", fallback?: string) =>
  renderToStaticMarkup(createElement(GenUi, { description, lang, fallback, onAction: () => {} }));

it("a proposal is a section named by its heading, with the changes as a list", () => {
  const html = render(proposal);
  expect(html).toMatch(/<section[^>]*aria-labelledby="([^"]+)"/);
  const id = /aria-labelledby="([^"]+)"/.exec(html)?.[1];
  expect(html).toContain(`<h3 id="${id}"`);
  expect(html).toContain("Proposed moves");
  expect(html).toContain("<ul");
  expect(html).toContain("Tuesday");
});

it("was and now are words, so colour is not the only signal", () => {
  const html = render(proposal);
  expect(html).toContain("Was: Run 8 km");
  expect(html).toContain("Now: Swim 2 km");
  expect(html).toContain('aria-hidden="true"');
});

it("Apply and Dismiss are real buttons with text labels", () => {
  const html = render(proposal);
  const buttons = [...html.matchAll(/<button[^>]*>([^<]+)<\/button>/g)];
  expect(buttons.map((match) => match[1])).toEqual(["Apply", "Dismiss"]);
  for (const [tag] of buttons) expect(tag).toContain('type="button"');
});

it("the labels come from the page, in every language", () => {
  for (const lang of LANGS) {
    const html = render(proposal, lang);
    expect(html).toContain(`>${STRINGS[lang].apply}</button>`);
    expect(html).toContain(`>${STRINGS[lang].dismiss}</button>`);
    expect(STRINGS[lang].invalid.length).toBeGreaterThan(0);
  }
});

it("text from the agent is escaped, never run as markup", () => {
  const html = render({
    component: "ChangeProposal",
    props: { title: "<script>alert(1)</script>", changes: [{ label: "<b>x</b>", before: '"><img src=x onerror=alert(1)>', after: "ok" }] },
  });
  expect(html).not.toContain("<script");
  expect(html).not.toContain("<img");
  expect(html).not.toContain("<b>x</b>");
  expect(html).toContain("&lt;script&gt;");
});

it("a component that is not in the catalog is ignored and the text is shown instead", () => {
  const html = render({ component: "Carousel", props: {} }, "en", "Here is my answer in words.");
  expect(html).toBe("Here is my answer in words.");
  expect(html).not.toContain("<button");
});

it("a description that is not valid says so in words, keeps the text, and the conversation continues", () => {
  const html = render({ component: "ChangeProposal", props: { title: "T", changes: [] } }, "nl", "Mijn antwoord in woorden.");
  expect(html).toContain('role="status"');
  expect(html).toContain(STRINGS.nl.invalid);
  expect(html).toContain("Mijn antwoord in woorden.");
  expect(html).not.toContain("<button");
});

it("something that is no description at all is not rendered as an interface", () => {
  for (const value of [null, undefined, "hello", 42, []]) {
    expect(render(value, "en", "text")).not.toContain("<button");
  }
});
