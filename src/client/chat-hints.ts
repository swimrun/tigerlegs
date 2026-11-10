import type { Lang } from "./language.ts";

/** Languages Gemini Nano accepts (Prompt API): the site languages minus Dutch (ADR-0010). */
export const NANO_LANGUAGES: readonly Lang[] = ["en", "fr", "de"];

export const isNanoLanguage = (lang: Lang): boolean => NANO_LANGUAGES.includes(lang);

/** Chrome (and not Edge or Opera, which have no Gemini Nano). */
export function isChromeBrowser(userAgent: string = globalThis.navigator?.userAgent ?? ""): boolean {
  return /Chrome\//.test(userAgent) && !/Edg\/|OPR\//.test(userAgent);
}

const SWITCH_TO_CHROME: Record<Lang, string> = {
  en: "Free questions need Chrome on a desktop computer (Gemini Nano). Switch to Chrome to use them.",
  nl: "Vrije vragen werken alleen in Chrome op een desktopcomputer (Gemini Nano). Schakel over naar Chrome om ze te gebruiken.",
  fr: "Les questions libres nécessitent Chrome sur ordinateur (Gemini Nano). Passe à Chrome pour les utiliser.",
  de: "Freie Fragen funktionieren nur in Chrome auf einem Desktop-Computer (Gemini Nano). Wechsle zu Chrome, um sie zu nutzen.",
};

/** Only languages Gemini Nano does not support need this text. */
const USE_SUPPORTED_LANGUAGE: Partial<Record<Lang, string>> = {
  nl: "Gemini Nano begrijpt geen Nederlands. Gebruik Engels, Frans of Duits voor vrije vragen, of kies een van de vaste opties.",
};

/**
 * Why a free-form question cannot go to Gemini Nano in this language and browser, or
 * `undefined` when the language is supported and the browser is Chrome.
 */
export function freeformHint(lang: Lang, chrome: boolean): string | undefined {
  if (!chrome) return SWITCH_TO_CHROME[lang];
  return USE_SUPPORTED_LANGUAGE[lang];
}
