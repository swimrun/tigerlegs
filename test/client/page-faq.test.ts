import { readFile } from "node:fs/promises";
import { expect, it } from "vitest";
import { parseFaq } from "../../src/client/chat-agent.ts";

const LANGS = ["en", "nl", "fr", "de"];
const load = async (name: string, lang: string) => parseFaq(JSON.parse(await readFile(`public/chat/${name}.${lang}.json`, "utf8")));

// The chat is contextual: the Pricing, About and Guidebook pages have their own questions (public/chat/faq-<page>.<lang>.json).
for (const name of ["faq-pricing", "faq-about", "faq-guidebook"]) {
  it(`${name} is valid in every language, with the same questions in the same order`, async () => {
    const english = await load(name, "en");
    expect(english.entries.length > 0).toEqual(true);
    for (const lang of LANGS) {
      const faq = await load(name, lang);
      expect(faq.language).toEqual(lang);
      expect(faq.entries.map((entry) => entry.id)).toEqual(english.entries.map((entry) => entry.id));
    }
  });
}

it("the Pricing FAQ names the draft prices and keeps hosting a profile in the free tier", async () => {
  const faq = await load("faq-pricing", "en");
  expect(faq.entries.find((entry) => entry.id === "prices")?.answer).toContain("€5 for Silver, €10 for Gold and €25 for Platinum");
  expect(faq.entries.find((entry) => entry.id === "profile-free")?.answer).toContain("free tier");
});
