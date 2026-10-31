import denoConfig from "../../deno.json" with { type: "json" };

type Lang = "en" | "nl";

const STORAGE_KEY = "tigerlegs-lang";

function initialLang(): Lang {
  const saved = localStorage.getItem(STORAGE_KEY);
  if (saved === "en" || saved === "nl") return saved;
  return navigator.language.toLowerCase().startsWith("nl") ? "nl" : "en";
}

function setLang(lang: Lang): void {
  document.documentElement.dataset.lang = lang;
  document.documentElement.lang = lang;
  document.querySelectorAll<HTMLElement>("[data-set-lang]").forEach((link) => {
    const active = link.dataset.setLang === lang;
    link.classList.toggle("border-b-2", active);
    link.classList.toggle("border-stone-900", active);
    if (active) link.setAttribute("aria-current", "true");
    else link.removeAttribute("aria-current");
  });
}

const versionLabel = document.getElementById("app-version");
if (versionLabel) versionLabel.textContent = `v${denoConfig.version}`;

document.querySelectorAll<HTMLElement>("[data-set-lang]").forEach((link) => {
  link.addEventListener("click", (event) => {
    event.preventDefault();
    const lang = link.dataset.setLang as Lang;
    localStorage.setItem(STORAGE_KEY, lang);
    setLang(lang);
  });
});
setLang(initialLang());

// Scroll-linked reveal: the tiger photo grows from a small corner to fully visible at the page end.
const tiger = document.querySelector<HTMLElement>(".tiger-fade");
const updateReveal = () => {
  if (!tiger) return;
  const max = document.documentElement.scrollHeight - globalThis.innerHeight;
  const progress = max > 0 ? Math.min(1, globalThis.scrollY / max) : 1;
  tiger.style.setProperty("--reveal", String(0.25 + 0.85 * progress));
};
globalThis.addEventListener("scroll", updateReveal, { passive: true });
globalThis.addEventListener("resize", updateReveal);
updateReveal();

// The Instagram embed is only loaded after a click, so visiting the page sends nothing to Meta.
document.getElementById("instagram-load")?.addEventListener("click", () => {
  const slot = document.getElementById("instagram-slot");
  if (!slot) return;
  const frame = document.createElement("iframe");
  frame.src = "https://www.instagram.com/swimrunrhederlaag/embed";
  frame.title = "Instagram: swimrunrhederlaag";
  frame.className = "mx-auto h-[640px] w-full max-w-md border-0";
  frame.loading = "lazy";
  frame.referrerPolicy = "no-referrer";
  slot.replaceChildren(frame);
});
