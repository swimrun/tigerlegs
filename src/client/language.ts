export const LANGS = ["en", "nl", "fr", "de"] as const;
export type Lang = typeof LANGS[number];

export const STORAGE_KEY = "tigerlegs-lang";

export const isLang = (value: string | null | undefined): value is Lang => LANGS.some((lang) => lang === value);

/** A saved choice wins over the browser language; English is the fallback. */
export function resolveLang(saved: string | null, browserLanguage: string): Lang {
  if (isLang(saved)) return saved;
  const browser = browserLanguage.toLowerCase().slice(0, 2);
  return isLang(browser) ? browser : "en";
}

/** The names of the site languages in English, for telling a model which language to write in (not a UI text). */
export const LANGUAGE_NAMES: Record<Lang, string> = { en: "English", nl: "Dutch", fr: "French", de: "German" };

/** The prefix of a chip that switches the page language (handled by the chat, not by the agent): "lang:en". */
export const LANGUAGE_CHIP = "lang:";

/**
 * Sets the language of the page, as the language switch in the header does: the choice is saved, `<html lang>` and
 * the switch follow, and everything that reads the page language (the chat, the training week) follows with them.
 */
export function setPageLanguage(lang: Lang): void {
  try {
    localStorage.setItem(STORAGE_KEY, lang);
  } catch {
    // A browser without storage still switches for this page.
  }
  document.documentElement.dataset.lang = lang;
  document.documentElement.lang = lang;
  const select = document.querySelector<HTMLSelectElement>("#language-switch");
  if (select) select.value = lang;
}
