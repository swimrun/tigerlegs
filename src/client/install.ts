/**
 * What the page can offer to install it as an app (issue #130, ADR-0021). Chromium browsers fire
 * `beforeinstallprompt` once they have decided that the site is installable, and the page can then show the
 * prompt from its own button; Safari on iOS has no such event, and a person adds the site through the Share menu,
 * so there the page can only explain how (MDN, "Making PWAs installable").
 */
export type InstallOffer = "none" | "prompt" | "ios";

/** The event of Chromium browsers; the TypeScript DOM library does not have it. */
export interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

/** The parts of `window` that this module reads, so that a test can pass a small fake. */
export interface InstallWindow {
  addEventListener(type: string, listener: (event: Event) => void): void;
  matchMedia(query: string): { matches: boolean };
  navigator: { userAgent: string; platform?: string; maxTouchPoints?: number; standalone?: boolean };
}

/** True when the page already runs as an installed app, in its own window. */
export function isStandalone(win: Pick<InstallWindow, "matchMedia" | "navigator">): boolean {
  return win.matchMedia("(display-mode: standalone)").matches || win.navigator.standalone === true;
}

/** An iPhone, an iPad, or an iPad that reports itself as a Mac (iPadOS does that, but a Mac has no touch screen). */
export function isIos(navigator: InstallWindow["navigator"]): boolean {
  return /iPhone|iPad|iPod/.test(navigator.userAgent) || (navigator.platform === "MacIntel" && (navigator.maxTouchPoints ?? 0) > 1);
}

/**
 * Nothing when the page already is an app. A waiting `beforeinstallprompt` event wins over the iOS hint, because
 * a button that can really install beats an explanation.
 */
export function installOffer({ standalone, ios, canPrompt }: { standalone: boolean; ios: boolean; canPrompt: boolean }): InstallOffer {
  if (standalone) return "none";
  if (canPrompt) return "prompt";
  return ios ? "ios" : "none";
}

/**
 * Keeps the event of the browser until the person asks for the prompt. It has to be created early, when the
 * page loads, because the browser fires the event only once; the footer button reads the store when it appears.
 * An event can be used once, so a button that has been used is gone, and the browser decides when to fire a new one.
 */
export function createInstallStore(win: InstallWindow) {
  let waiting: BeforeInstallPromptEvent | null = null;
  const listeners = new Set<() => void>();
  const notify = () => listeners.forEach((listener) => listener());

  win.addEventListener("beforeinstallprompt", (event) => {
    // Without this the browser shows its own prompt at its own moment; a button of ours is a choice of the person.
    event.preventDefault();
    waiting = event as BeforeInstallPromptEvent;
    notify();
  });
  win.addEventListener("appinstalled", () => {
    waiting = null;
    notify();
  });

  return {
    subscribe(listener: () => void): () => void {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    offer(): InstallOffer {
      return installOffer({ standalone: isStandalone(win), ios: isIos(win.navigator), canPrompt: waiting !== null });
    },
    /** Shows the prompt of the browser and says what the person chose. */
    async prompt(): Promise<"accepted" | "dismissed" | "unavailable"> {
      const event = waiting;
      if (!event) return "unavailable";
      waiting = null;
      notify();
      await event.prompt();
      return (await event.userChoice).outcome;
    },
  };
}

export type InstallStore = ReturnType<typeof createInstallStore>;

let store: InstallStore | null = null;

/** The store of this page, made on first use; `null` where there is no window (the server render of Astro). */
export function installStore(): InstallStore | null {
  if (typeof window === "undefined") return null;
  store ??= createInstallStore(window as unknown as InstallWindow);
  return store;
}
