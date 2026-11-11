// Runs on every page load: with view transitions this module is only evaluated once.
document.addEventListener("astro:page-load", () => {
  const abort = new AbortController();
  document.addEventListener("astro:before-swap", () => abort.abort(), { once: true });
  // Scroll-linked reveal: the tiger photo grows from a small corner to fully visible at the page end.
  const tiger = document.querySelector<HTMLElement>(".tiger-fade");
  const reducedMotion = globalThis.matchMedia("(prefers-reduced-motion: reduce)");
  const updateReveal = () => {
    if (!tiger) return;
    const max = document.documentElement.scrollHeight - globalThis.innerHeight;
    const progress = max > 0 ? Math.min(1, globalThis.scrollY / max) : 1;
    tiger.style.setProperty("--reveal", String(0.05 + 1.05 * progress ** 2.5));
    // The picture starts smaller and grows with the reveal; no growing for people who prefer reduced motion.
    tiger.style.setProperty("--zoom", String(reducedMotion.matches ? 1 : 0.8 + 0.2 * progress ** 1.5));
  };
  globalThis.addEventListener("scroll", updateReveal, { passive: true, signal: abort.signal });
  globalThis.addEventListener("resize", updateReveal, { signal: abort.signal });
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
});
