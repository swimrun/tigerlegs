import i18next, { type i18n, type TFunction } from "i18next";
import ICU from "i18next-icu";
import type { Lang } from "./language.ts";
import de from "../data/extractor.de.json";
import en from "../data/extractor.en.json";
import fr from "../data/extractor.fr.json";
import nl from "../data/extractor.nl.json";

/**
 * Localisation with i18next and the ICU message syntax (ADR-0017). The texts are data (`src/data/<feature>.<lang>.json`),
 * and the ICU syntax in them does what a function in code used to do: plurals (`{count, plural, one {# point} other {# points}}`),
 * numbers and dates in the format of the language (`{count, number}`, `{date, date, long}`), and choices (`{worker, select, …}`).
 * The Extractor is the first feature on it; the other pages still have their own per-language files (issue #84).
 */
export const EXTRACTOR = "extractor";

let instance: i18n | undefined;

/** One instance for the page. It starts synchronously, so a server render and the first client render agree. */
export function i18nInstance(): i18n {
  if (!instance) {
    instance = i18next.createInstance();
    void instance.use(new ICU()).init({
      lng: "en",
      fallbackLng: "en",
      initAsync: false,
      defaultNS: EXTRACTOR,
      ns: [EXTRACTOR],
      resources: { en: { [EXTRACTOR]: en }, nl: { [EXTRACTOR]: nl }, fr: { [EXTRACTOR]: fr }, de: { [EXTRACTOR]: de } },
      // React escapes text itself, and a message with a tag is rendered through <Trans>.
      interpolation: { escapeValue: false },
    });
  }
  return instance;
}

/** The translate function of the Extractor texts for one language. */
export function extractorT(lang: Lang): TFunction {
  return i18nInstance().getFixedT(lang, EXTRACTOR);
}
