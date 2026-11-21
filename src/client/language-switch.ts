import { isLang, resolveLang, setPageLanguage, STORAGE_KEY } from "./language.ts";

// With view transitions the header is replaced on every navigation, so bind on each page load.
document.addEventListener("astro:page-load", () => {
  const select = document.querySelector<HTMLSelectElement>("#language-switch");
  select?.addEventListener("change", () => {
    if (!isLang(select.value)) return;
    setPageLanguage(select.value);
  });
  setPageLanguage(resolveLang(localStorage.getItem(STORAGE_KEY), navigator.language));
});

// The incoming page says lang="en"; keep the chosen language so the persistent chat is not reset.
document.addEventListener("astro:before-swap", (event) => {
  const { documentElement } = (event as Event & { newDocument: Document }).newDocument;
  documentElement.lang = document.documentElement.lang;
  documentElement.dataset.lang = document.documentElement.dataset.lang ?? documentElement.lang;
});
