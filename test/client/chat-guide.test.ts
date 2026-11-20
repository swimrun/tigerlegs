import { expect, it } from "vitest";
import type { ChatAgent, ChatEvent } from "../../src/client/chat-agent.ts";
import { GUIDE_PAGES, guideLinks, isPageKey, pageHref, withPageGuide } from "../../src/client/chat-guide.ts";
import { STRINGS } from "../../src/client/chat.strings.ts";

const texts = STRINGS.en.guide;
const inner: ChatAgent = {
  suggestions: async () => [{ id: "x", label: "Inner question" }],
  async *run() {
    yield { type: "text", text: "inner answer" };
  },
};
const collect = async (agent: ChatAgent, message: string) => {
  const events: ChatEvent[] = [];
  for await (const event of agent.run(message)) events.push(event);
  return events;
};

it("puts the guide chip first on every page, in front of the questions of the wrapped agent", async () => {
  const suggestions = await withPageGuide(inner, texts, "pricing", "/tigerlegs/").suggestions();
  expect(suggestions.map((s) => s.label)).toEqual(["What can I do in this TigerLegs web app?", "Inner question"]);
});

it("answers the guide question with links to the other pages, not the current one", async () => {
  for (const current of GUIDE_PAGES) {
    const events = await collect(withPageGuide(inner, texts, current, "/tigerlegs/"), texts.question);
    const reply = events.find((event) => event.type === "text");
    const labels = reply?.type === "text" ? reply.links?.map((link) => link.label) : [];
    expect(labels).toEqual(GUIDE_PAGES.filter((page) => page !== current).map((page) => texts.pages[page]));
    expect(reply?.type === "text" && reply.text.includes(texts.descriptions[current])).toEqual(false);
  }
});

it("links to the right addresses, relative when there is no base", () => {
  expect(guideLinks(texts, "extractor", "/tigerlegs/").map((link) => link.href)).toEqual(["/tigerlegs/training.html", "/tigerlegs/pricing.html", "/tigerlegs/about.html", "/tigerlegs/guidebook.html"]);
  expect(pageHref("extractor", "")).toEqual("./");
  expect(pageHref("training", "")).toEqual("./training.html");
});

it("passes every other message on to the wrapped agent", async () => {
  const events = await collect(withPageGuide(inner, texts, undefined, ""), "something else");
  expect(events).toEqual([{ type: "text", text: "inner answer" }]);
});

it("knows the pages of the site", () => {
  expect(["extractor", "training", "pricing", "about", "guidebook", "profile"].every(isPageKey)).toEqual(true);
  expect(isPageKey("nope")).toEqual(false);
});

it("has the guide in every language, with a link text and a description for each page", () => {
  for (const lang of ["en", "nl", "fr", "de"] as const) {
    const guide = STRINGS[lang].guide;
    expect(guide.question.length > 0 && guide.intro.length > 0).toEqual(true);
    for (const page of GUIDE_PAGES) expect(guide.descriptions[page].length > 0 && guide.pages[page].length > 0).toEqual(true);
  }
});
