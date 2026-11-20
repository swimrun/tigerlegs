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
 * What replaces the fallback of the FAQ chat when a free question is asked. Only the training chat has a model,
 * so on every other page the answer is the same in every browser and language: free questions go to the
 * Training page, and here only the suggested questions work.
 */
export function faqFreeformHint(lang: Lang): string {
  return STRINGS[lang].freeQuestionsOnTraining;
}
