import { expect, it } from "vitest";
import { resolveLang } from "../../src/client/language.ts";

it("resolveLang: saved choice beats browser language", () => {
  expect(resolveLang("de", "nl-NL")).toEqual("de");
});

it("resolveLang: browser language is used when nothing is saved or saved is invalid", () => {
  expect(resolveLang(null, "nl-NL")).toEqual("nl");
  expect(resolveLang("xx", "fr")).toEqual("fr");
});

it("resolveLang: unsupported browser language falls back to English", () => {
  expect(resolveLang(null, "ja-JP")).toEqual("en");
});
