import { expect, it } from "vitest";
import { createInstallStore, type InstallWindow, installOffer, isIos, isStandalone } from "../../src/client/install.ts";

const IPHONE = "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1";
const IPAD = "Mozilla/5.0 (iPad; CPU OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1";
const MAC = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15";
const ANDROID = "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Mobile Safari/537.36";

/** A small `window`: it can fire events, and it says whether the page runs as an app. */
function fakeWindow(options: { standalone?: boolean; legacyStandalone?: boolean; userAgent?: string; platform?: string; maxTouchPoints?: number } = {}) {
  const target = new EventTarget();
  const win: InstallWindow = {
    addEventListener: (type, listener) => target.addEventListener(type, listener),
    matchMedia: (query) => ({ matches: query === "(display-mode: standalone)" && (options.standalone ?? false) }),
    navigator: {
      userAgent: options.userAgent ?? ANDROID,
      platform: options.platform,
      maxTouchPoints: options.maxTouchPoints,
      standalone: options.legacyStandalone,
    },
  };
  return { win, fire: (event: Event) => target.dispatchEvent(event) };
}

/** The event of a Chromium browser, with a prompt that counts how often it was shown. */
function promptEvent(outcome: "accepted" | "dismissed") {
  const event = new Event("beforeinstallprompt", { cancelable: true });
  const shown = { count: 0 };
  Object.assign(event, {
    prompt: async () => {
      shown.count++;
    },
    userChoice: Promise.resolve({ outcome }),
  });
  return { event, shown };
}

it("the offer: nothing as an app, the prompt where there is one, the explanation on iOS, otherwise nothing", () => {
  expect(installOffer({ standalone: true, ios: true, canPrompt: true })).toBe("none");
  expect(installOffer({ standalone: false, ios: false, canPrompt: true })).toBe("prompt");
  expect(installOffer({ standalone: false, ios: true, canPrompt: true }), "a button that can install beats an explanation").toBe("prompt");
  expect(installOffer({ standalone: false, ios: true, canPrompt: false })).toBe("ios");
  expect(installOffer({ standalone: false, ios: false, canPrompt: false })).toBe("none");
});

it("iOS is an iPhone, an iPad, or an iPad that says it is a Mac and has a touch screen", () => {
  expect(isIos({ userAgent: IPHONE })).toBe(true);
  expect(isIos({ userAgent: IPAD })).toBe(true);
  expect(isIos({ userAgent: MAC, platform: "MacIntel", maxTouchPoints: 5 })).toBe(true);
  expect(isIos({ userAgent: MAC, platform: "MacIntel", maxTouchPoints: 0 })).toBe(false);
  expect(isIos({ userAgent: MAC, platform: "MacIntel" })).toBe(false);
  expect(isIos({ userAgent: ANDROID })).toBe(false);
});

it("a page runs as an app in the standalone display mode, or on older iOS when navigator.standalone is true", () => {
  expect(isStandalone(fakeWindow({ standalone: true }).win)).toBe(true);
  expect(isStandalone(fakeWindow({ legacyStandalone: true }).win)).toBe(true);
  expect(isStandalone(fakeWindow({ legacyStandalone: false }).win)).toBe(false);
  expect(isStandalone(fakeWindow().win)).toBe(false);
});

it("the store offers nothing until the browser fires the event, then holds the browser's own prompt back", () => {
  const { win, fire } = fakeWindow();
  const store = createInstallStore(win);
  let notified = 0;
  store.subscribe(() => notified++);
  expect(store.offer()).toBe("none");

  const { event } = promptEvent("accepted");
  fire(event);
  expect(event.defaultPrevented, "the browser does not show its own prompt").toBe(true);
  expect(store.offer()).toBe("prompt");
  expect(notified).toBe(1);
});

it("the prompt is shown once, says what the person chose, and the button is then used up", async () => {
  const { win, fire } = fakeWindow();
  const store = createInstallStore(win);
  const { event, shown } = promptEvent("dismissed");
  fire(event);

  expect(await store.prompt()).toBe("dismissed");
  expect(shown.count).toBe(1);
  expect(store.offer(), "an event can be used once; the browser decides when to fire a new one").toBe("none");
  expect(await store.prompt()).toBe("unavailable");
  expect(shown.count).toBe(1);

  const next = promptEvent("accepted");
  fire(next.event);
  expect(store.offer(), "a new event brings the button back").toBe("prompt");
  expect(await store.prompt()).toBe("accepted");
});

it("once the app is installed, the button goes", () => {
  const { win, fire } = fakeWindow();
  const store = createInstallStore(win);
  fire(promptEvent("accepted").event);
  expect(store.offer()).toBe("prompt");
  fire(new Event("appinstalled"));
  expect(store.offer()).toBe("none");
});

it("an iPhone gets the explanation, and an installed app gets nothing", () => {
  expect(createInstallStore(fakeWindow({ userAgent: IPHONE }).win).offer()).toBe("ios");
  expect(createInstallStore(fakeWindow({ userAgent: IPHONE, legacyStandalone: true }).win).offer()).toBe("none");
  expect(createInstallStore(fakeWindow({ standalone: true }).win).offer()).toBe("none");
});

it("a listener that is removed is no longer told", () => {
  const { win, fire } = fakeWindow();
  const store = createInstallStore(win);
  let notified = 0;
  const unsubscribe = store.subscribe(() => notified++);
  unsubscribe();
  fire(promptEvent("accepted").event);
  expect(notified).toBe(0);
});
