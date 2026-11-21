import i18next, { type i18n, type TFunction } from "i18next";
import ICU from "i18next-icu";
import type { Lang } from "./language.ts";
import de from "../data/extractor.de.json" with { type: "json" };
import en from "../data/extractor.en.json" with { type: "json" };
import fr from "../data/extractor.fr.json" with { type: "json" };
import nl from "../data/extractor.nl.json" with { type: "json" };
import chatDe from "../data/chat.de.json" with { type: "json" };
import chatEn from "../data/chat.en.json" with { type: "json" };
import chatFr from "../data/chat.fr.json" with { type: "json" };
import chatNl from "../data/chat.nl.json" with { type: "json" };
import trainingDe from "../data/training.de.json" with { type: "json" };
import trainingEn from "../data/training.en.json" with { type: "json" };
import trainingFr from "../data/training.fr.json" with { type: "json" };
import trainingNl from "../data/training.nl.json" with { type: "json" };

/**
 * Localisation with i18next and the ICU message syntax (ADR-0017). The texts are data (`src/data/<feature>.<lang>.json`),
 * and the ICU syntax in them does what a function in code used to do: plurals (`{count, plural, one {# point} other {# points}}`),
 * numbers and dates in the format of the language (`{count, number}`, `{date, date, long}`), and choices (`{worker, select, …}`).
 * The Extractor, the Training page and the chat are on it; the other pages still have their own per-language files (issue #84).
 */
export const EXTRACTOR = "extractor";
export const TRAINING = "training";
export const CHAT = "chat";

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
      ns: [EXTRACTOR, TRAINING, CHAT],
      resources: {
        en: { [EXTRACTOR]: en, [TRAINING]: trainingEn, [CHAT]: chatEn },
        nl: { [EXTRACTOR]: nl, [TRAINING]: trainingNl, [CHAT]: chatNl },
        fr: { [EXTRACTOR]: fr, [TRAINING]: trainingFr, [CHAT]: chatFr },
        de: { [EXTRACTOR]: de, [TRAINING]: trainingDe, [CHAT]: chatDe },
      },
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

/** The translate function of the Training page and its chat agent for one language. */
export function trainingT(lang: Lang): TFunction {
  return i18nInstance().getFixedT(lang, TRAINING);
}

/** The texts of a namespace as they are in the file, for the ones that need no variables. */
export function bundle<T>(lang: Lang, namespace: string): T {
  return i18nInstance().getResourceBundle(lang, namespace) as T;
}
