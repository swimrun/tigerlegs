import { assertEquals } from "@std/assert";
import { resolveLang } from "../../src/client/language.ts";

Deno.test("resolveLang: saved choice beats browser language", () => {
  assertEquals(resolveLang("de", "nl-NL"), "de");
});

Deno.test("resolveLang: browser language is used when nothing is saved or saved is invalid", () => {
  assertEquals(resolveLang(null, "nl-NL"), "nl");
  assertEquals(resolveLang("xx", "fr"), "fr");
});

Deno.test("resolveLang: unsupported browser language falls back to English", () => {
  assertEquals(resolveLang(null, "ja-JP"), "en");
});
