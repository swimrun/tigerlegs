import { isLang, type Lang, resolveLang, STORAGE_KEY } from "./language.ts";

function setLang(lang: Lang): void {
  document.documentElement.dataset.lang = lang;
  document.documentElement.lang = lang;
  document.querySelectorAll<HTMLElement>("[data-set-lang]").forEach((link) => {
    if (link.dataset.setLang === lang) link.setAttribute("aria-current", "true");
    else link.removeAttribute("aria-current");
  });
}

document.querySelectorAll<HTMLElement>("[data-set-lang]").forEach((link) => {
  link.addEventListener("click", (event) => {
    event.preventDefault();
    const lang = link.dataset.setLang;
    if (!isLang(lang)) return;
    localStorage.setItem(STORAGE_KEY, lang);
    setLang(lang);
  });
});
setLang(resolveLang(localStorage.getItem(STORAGE_KEY), navigator.language));
