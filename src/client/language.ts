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
