/**
 * User agents as the browsers send them, for the tests that depend on the browser. Gemini Nano exists only in
 * Chrome on a desktop computer (ADR-0010), and several browsers look like Chrome, so `chrome` says what the site is
 * meant to do with each one; it is written out here and not computed, so that a test does not check a function
 * against itself.
 */
export interface TestBrowser {
  name: string;
  userAgent: string;
  chrome: boolean;
}

const WEBKIT = "AppleWebKit/537.36 (KHTML, like Gecko)";
const MAC = "Macintosh; Intel Mac OS X 10_15_7";

export const BROWSERS: readonly TestBrowser[] = [
  { name: "Chrome on macOS", userAgent: `Mozilla/5.0 (${MAC}) ${WEBKIT} Chrome/126.0.0.0 Safari/537.36`, chrome: true },
  { name: "Chrome on Windows", userAgent: `Mozilla/5.0 (Windows NT 10.0; Win64; x64) ${WEBKIT} Chrome/126.0.0.0 Safari/537.36`, chrome: true },
  { name: "Chrome on Android", userAgent: `Mozilla/5.0 (Linux; Android 14; Pixel 8) ${WEBKIT} Chrome/126.0.0.0 Mobile Safari/537.36`, chrome: true },
  { name: "Headless Chrome", userAgent: `Mozilla/5.0 (${MAC}) ${WEBKIT} HeadlessChrome/126.0.0.0 Safari/537.36`, chrome: true },
  { name: "Edge", userAgent: `Mozilla/5.0 (Windows NT 10.0; Win64; x64) ${WEBKIT} Chrome/126.0.0.0 Safari/537.36 Edg/126.0.0.0`, chrome: false },
  { name: "Opera", userAgent: `Mozilla/5.0 (Windows NT 10.0; Win64; x64) ${WEBKIT} Chrome/126.0.0.0 Safari/537.36 OPR/112.0.0.0`, chrome: false },
  { name: "Firefox", userAgent: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:127.0) Gecko/20100101 Firefox/127.0", chrome: false },
  { name: "Safari on macOS", userAgent: `Mozilla/5.0 (${MAC}) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Safari/605.1.15`, chrome: false },
  { name: "Safari on iOS", userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1", chrome: false },
  // Chrome on iOS is WebKit with a Chrome skin ("CriOS"), and has no Gemini Nano.
  { name: "Chrome on iOS", userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/126.0.6478.153 Mobile/15E148 Safari/604.1", chrome: false },
];

/** The browsers that the tests in a real browser use: one of each kind, so that the suite stays quick. */
export const SITE_BROWSERS: readonly TestBrowser[] = BROWSERS.filter(({ name }) =>
  ["Chrome on macOS", "Chrome on Android", "Edge", "Firefox", "Safari on macOS", "Chrome on iOS"].includes(name)
);
