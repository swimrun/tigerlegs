import { expect, it } from "vitest";
import { extractorT, i18nInstance } from "../../src/client/i18n.ts";
import { LANGS } from "../../src/client/language.ts";
import { localizeNumber } from "../../src/client/numbers.ts";
import de from "../../src/data/extractor.de.json";
import en from "../../src/data/extractor.en.json";
import fr from "../../src/data/extractor.fr.json";
import nl from "../../src/data/extractor.nl.json";

const FILES = { en, nl, fr, de } as const;

/** "table.swimM" for every text in the nested file. */
const keys = (value: Record<string, unknown>, prefix = ""): string[] =>
  Object.entries(value).flatMap(([key, entry]) =>
    typeof entry === "object" && entry !== null ? keys(entry as Record<string, unknown>, `${prefix}${key}.`) : [`${prefix}${key}`]);

it("every language has exactly the keys of English (a language file that misses a key fails)", () => {
  for (const lang of LANGS) expect(keys(FILES[lang]).sort(), lang).toEqual(keys(en).sort());
});

it("every message is valid ICU and gives text without a leftover placeholder, in every language", () => {
  const values = { number: 3, name: "A", count: 2, seconds: 1.5, worker: "true", downloaded: "false", mb: 4.2, date: new Date("2026-06-20T12:00:00Z"), km: "1.5", type: "x", distance: "2", unit: "km", strategies: "speed", index: 4, resolvedBy: "speed", status: 404, reason: "r" };
  for (const lang of LANGS) {
    const t = extractorT(lang);
    for (const key of keys(en)) {
      const text = t(key, values);
      expect(text, `${lang} ${key}`).not.toBe(key);
      expect(text, `${lang} ${key}`).not.toMatch(/\{[a-zA-Z]+/);
    }
  }
});

it("plurals follow the language: one trackpoint and several, with the number written the way the language does", () => {
  const sentence = (lang: "en" | "nl" | "fr" | "de", count: number) => extractorT(lang)("statusAnalysed", { count, seconds: 0.3, worker: "false" });
  expect(sentence("en", 1)).toBe("Analysed 1 trackpoint in 0.3 s.");
  expect(sentence("en", 1234)).toBe("Analysed 1,234 trackpoints in 0.3 s.");
  expect(sentence("nl", 1)).toBe("1 trackpunt geanalyseerd in 0,3 s.");
  expect(sentence("nl", 1234)).toBe("1.234 trackpunten geanalyseerd in 0,3 s.");
  // French counts 0 and 1 as the singular ("one"), English only 1: the rule belongs to the language, not to our code.
  expect(sentence("fr", 0)).toContain("0 point de trace analysé");
  expect(sentence("en", 0)).toContain("0 trackpoints");
  expect(sentence("de", 1)).toBe("1 Trackpunkt analysiert in 0,3 s.");
});

it("a choice (select) adds the background worker, and a date is written in the language", () => {
  expect(extractorT("en")("statusAnalysed", { count: 2, seconds: 1, worker: "true" })).toContain("(background worker)");
  expect(extractorT("en")("statusAnalysed", { count: 2, seconds: 1, worker: "false" })).not.toContain("worker");
  const date = new Date("2026-06-20T12:00:00Z");
  expect(extractorT("en")("recorded", { date })).toBe("Recorded on June 20, 2026");
  expect(extractorT("nl")("recorded", { date })).toBe("Opgenomen op 20 juni 2026");
  expect(extractorT("fr")("recorded", { date })).toBe("Enregistré le 20 juin 2026");
  expect(extractorT("de")("recorded", { date })).toBe("Aufgezeichnet am 20. Juni 2026");
});

it("the English texts are what the page showed before it was translated", () => {
  const t = extractorT("en");
  expect(t("upload")).toBe("Upload a .gpx file");
  expect(t("largeFile", { mb: 3.4, downloaded: "false" })).toBe("Large file (3.4 MB). Analysing it can take a while and uses your device's processor and battery, so a phone may get warm. The file is not uploaded, so this costs no data. Please keep this page open.");
  expect(t("trackOption", { name: "Track 1", count: 12345 })).toBe("Track 1 (12,345 points)");
});

it("numbers that a calculation wrote as text get the decimal comma of the language and keep their decimals", () => {
  expect(localizeNumber("24.7", "en")).toBe("24.7");
  expect(localizeNumber("24.7", "nl")).toBe("24,7");
  expect(localizeNumber("24.70", "fr")).toBe("24,70");
  expect(localizeNumber("6250", "de")).toBe("6250");
  expect(localizeNumber("12345.5", "nl"), "no thousands separator, as before").toBe("12345,5");
  expect(localizeNumber("—", "nl")).toBe("—");
  expect(localizeNumber("", "nl")).toBe("");
});

it("one instance serves the page, and an unknown language falls back to English", () => {
  expect(i18nInstance()).toBe(i18nInstance());
  expect(i18nInstance().getFixedT("xx", "extractor")("upload")).toBe("Upload a .gpx file");
});
