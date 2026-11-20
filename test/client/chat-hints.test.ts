import { afterEach, expect, it, vi } from "vitest";
import { STRINGS } from "../../src/client/chat.strings.ts";
import { faqFreeformHint, freeformHint, isChromeBrowser, isNanoLanguage, NANO_LANGUAGES } from "../../src/client/chat-hints.ts";
import { LANGS } from "../../src/client/language.ts";
import { BROWSERS } from "../user-agents.ts";

it("only Chrome counts as Chrome: Edge, Opera, Firefox, Safari and Chrome on iOS have no Gemini Nano", () => {
  for (const { name, userAgent, chrome } of BROWSERS) expect(isChromeBrowser(userAgent), name).toBe(chrome);
});

it("Gemini Nano accepts English, French and German, and not Dutch", () => {
  expect(NANO_LANGUAGES).toEqual(["en", "fr", "de"]);
  expect(Object.fromEntries(LANGS.map((lang) => [lang, isNanoLanguage(lang)]))).toEqual({ en: true, nl: false, fr: true, de: true });
});

it("the hint of a free question: switch to Chrome in any other browser, use another language in Dutch, nothing otherwise", () => {
  for (const lang of LANGS) {
    expect(freeformHint(lang, false), `${lang}, not Chrome`).toBe(STRINGS[lang].switchToChrome);
    expect(freeformHint(lang, true), `${lang}, Chrome`).toBe(lang === "nl" ? STRINGS.nl.useSupportedLanguage : undefined);
  }
  expect(STRINGS.nl.useSupportedLanguage?.length, "Dutch says which languages do work").toBeGreaterThan(0);
});

it("every language has its own hint text, so that none is shown in the wrong language", () => {
  const texts = LANGS.map((lang) => STRINGS[lang].switchToChrome);
  expect(new Set(texts).size).toBe(LANGS.length);
});

it("the FAQ chat has no model: free questions are sent to the Training page, in every browser and language", () => {
  for (const lang of LANGS) {
    expect(faqFreeformHint(lang), lang).toBe(STRINGS[lang].freeQuestionsOnTraining);
    expect(STRINGS[lang].freeQuestionsOnTraining, `${lang} names the Training page`).toContain("Training");
  }
  expect(new Set(LANGS.map((lang) => STRINGS[lang].freeQuestionsOnTraining)).size, "each language has its own text").toBe(LANGS.length);
});

afterEach(() => vi.unstubAllGlobals());

it("without a user agent it reads the one of the browser that it runs in", () => {
  const chrome = BROWSERS.find((browser) => browser.name === "Chrome on macOS")!;
  const safari = BROWSERS.find((browser) => browser.name === "Safari on macOS")!;
  vi.stubGlobal("navigator", { userAgent: chrome.userAgent });
  expect(isChromeBrowser()).toBe(true);
  vi.stubGlobal("navigator", { userAgent: safari.userAgent });
  expect(isChromeBrowser()).toBe(false);
});

it("where there is no navigator at all, as in a server render, it is not Chrome and does not fail", () => {
  vi.stubGlobal("navigator", undefined);
  expect(isChromeBrowser()).toBe(false);
});
