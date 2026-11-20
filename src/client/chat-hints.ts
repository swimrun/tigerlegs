import { STRINGS } from "./chat.strings.ts";
import type { Lang } from "./language.ts";

/** Languages Gemini Nano accepts (Prompt API): the site languages minus Dutch (ADR-0010). */
export const NANO_LANGUAGES: readonly Lang[] = ["en", "fr", "de"];

export const isNanoLanguage = (lang: Lang): boolean => NANO_LANGUAGES.includes(lang);

/** Chrome (and not Edge or Opera, which have no Gemini Nano). */
// Stryker disable next-line StringLiteral: any text without "Chrome/" answers like the empty string
export function isChromeBrowser(userAgent: string = globalThis.navigator?.userAgent ?? ""): boolean {
  return /Chrome\//.test(userAgent) && !/Edg\/|OPR\//.test(userAgent);
}

/**
 * Why a free-form question cannot go to Gemini Nano in this language and browser, or
 * `undefined` when the language is supported and the browser is Chrome.
 */
export function freeformHint(lang: Lang, chrome: boolean): string | undefined {
  if (!chrome) return STRINGS[lang].switchToChrome;
  return STRINGS[lang].useSupportedLanguage;
}

/**
 * What replaces the fallback of the FAQ chat when a free question is asked. The FAQ has no model yet, so for a
 * language that Gemini Nano accepts there is no hint, whatever the browser, and the fallback of the FAQ says that
 * there is no model; for the other languages the hint says why free questions cannot work. The training chat is
 * different: it does use the model, so there the browser matters (`freeformHint`).
 */
export function faqFreeformHint(lang: Lang, userAgent?: string): string | undefined {
  return isNanoLanguage(lang) ? undefined : freeformHint(lang, isChromeBrowser(userAgent));
}
