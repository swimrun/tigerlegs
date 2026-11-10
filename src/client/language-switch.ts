import { isLang, type Lang, resolveLang, STORAGE_KEY } from "./language.ts";

function setLang(lang: Lang): void {
  document.documentElement.dataset.lang = lang;
  document.documentElement.lang = lang;
  const select = document.querySelector<HTMLSelectElement>("#language-switch");
  if (select) select.value = lang;
}

// With view transitions the header is replaced on every navigation, so bind on each page load.
document.addEventListener("astro:page-load", () => {
  const select = document.querySelector<HTMLSelectElement>("#language-switch");
  select?.addEventListener("change", () => {
    if (!isLang(select.value)) return;
    localStorage.setItem(STORAGE_KEY, select.value);
    setLang(select.value);
  });
  setLang(resolveLang(localStorage.getItem(STORAGE_KEY), navigator.language));
});

// The incoming page says lang="en"; keep the chosen language so the persistent chat is not reset.
document.addEventListener("astro:before-swap", (event) => {
  const { documentElement } = (event as Event & { newDocument: Document }).newDocument;
  documentElement.lang = document.documentElement.lang;
  documentElement.dataset.lang = document.documentElement.dataset.lang ?? documentElement.lang;
});
