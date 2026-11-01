// Scroll-linked reveal: the tiger photo grows from a small corner to fully visible at the page end.
const tiger = document.querySelector<HTMLElement>(".tiger-fade");
const updateReveal = () => {
  if (!tiger) return;
  const max = document.documentElement.scrollHeight - globalThis.innerHeight;
  const progress = max > 0 ? Math.min(1, globalThis.scrollY / max) : 1;
  tiger.style.setProperty("--reveal", String(0.12 + 0.98 * progress));
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
