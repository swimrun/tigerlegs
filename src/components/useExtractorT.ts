import { useMemo } from "react";
import { extractorT } from "../client/i18n.ts";
import type { Lang } from "../client/language.ts";
import { usePageLang } from "./usePageLang.ts";

/** The Extractor texts in the language of the page, with the language itself for the formatting of numbers. */
export function useExtractorT() {
  const lang = usePageLang();
  const t = useMemo(() => extractorT(lang), [lang]);
  return { t, lang: lang as Lang };
}
