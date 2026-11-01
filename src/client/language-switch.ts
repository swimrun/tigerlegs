import { isLang, type Lang, resolveLang, STORAGE_KEY } from "./language.ts";

const select = document.querySelector<HTMLSelectElement>("#language-switch");

function setLang(lang: Lang): void {
  document.documentElement.dataset.lang = lang;
  document.documentElement.lang = lang;
  if (select) select.value = lang;
}

select?.addEventListener("change", () => {
  if (!isLang(select.value)) return;
  localStorage.setItem(STORAGE_KEY, select.value);
  setLang(select.value);
});
setLang(resolveLang(localStorage.getItem(STORAGE_KEY), navigator.language));
