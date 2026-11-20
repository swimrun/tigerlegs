import { useEffect, useState } from "react";
import { isLang, type Lang } from "../client/language.ts";

/** The page language, which the language switch keeps on the `lang` attribute of `<html>`. */
export function usePageLang(): Lang {
  const [lang, setLang] = useState<Lang>("en");
  useEffect(() => {
    const read = () => {
      const value = document.documentElement.lang;
      setLang(isLang(value) ? value : "en");
    };
    read();
    const observer = new MutationObserver(read);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ["lang"] });
    return () => observer.disconnect();
  }, []);
  return lang;
}
