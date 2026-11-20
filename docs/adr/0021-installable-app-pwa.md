# 21. Installable app (PWA): the manifest and an install button first, offline use later

Date: 2026-11-16

## 1. Status

Proposed. Built and tested in the browser tests; the install flow itself is not yet tried on a real Android phone and a real iPhone. Issue #130.

## 2. Context

A swimrunner wants an icon on the home screen of a phone that opens TigerLegs like an app. The site is a static Astro site under `/tigerlegs`, with React islands, and the data of the athlete stays in the browser (the privacy principle of the guidebook).

What makes a site installable, according to MDN: Chromium browsers need a `name` or `short_name`, `icons` with 192 and 512 pixels, a `start_url`, a `display` or `display_override`, and `prefer_related_applications` absent or `false`, over HTTPS (MDN Contributors, n.d.-a). A service worker is not one of them: "While not a requirement for a PWA to be installable, many PWAs use service workers to provide an offline experience" (MDN Contributors, n.d.-a).

The platforms differ. Chromium browsers fire `beforeinstallprompt` "as soon as the browser has determined that the PWA is installable", and the page can show the prompt from a button of its own; "This is not supported on iOS" (MDN Contributors, n.d.-a). On iOS 16.4 and later "PWAs can be installed from the Share menu in Safari, Chrome, Edge, Firefox, and Orion" (MDN Contributors, n.d.-a), so there the page can only explain how.

The prompt itself is the dialog of the browser, and the page can only start it from an action of the person: `prompt()` "must be called in the event handler for a user action (such as a button click)" (MDN Contributors, n.d.-d). It can be used once per event: "You can only call `prompt()` on the deferred event once. If the user dismisses it, you need to wait until the `beforeinstallprompt` event is fired again" (web.dev, n.d.-a), and that is "typically immediately after the `userChoice` property has resolved" (web.dev, n.d.-b). Cancelling does not block later prompts: "Unlike traditional permission requests, clicking cancel will not block future calls to `prompt()`" (Chrome for Developers, n.d.). If the page does not call `preventDefault()` on the event, Chrome for Android shows a mini infobar by itself: "the banner will be shown the first time a user visits your site and meets the installability criteria on Android, and then again after approximately 90 days" (web.dev, n.d.-c). These pages are not dated, and the Chrome post says that the mini infobar comes "regardless of whether you `preventDefault()` on the `beforeinstallprompt` event or not" (Chrome for Developers, n.d.), which web.dev contradicts; so the behaviour has to be tried on a device.

On iOS the page cannot start anything. web.dev says: "Chrome and Edge on iOS and iPadOS do not support PWA installation, so the `beforeinstallprompt` event can't fire. In this case, the only option is to open the PWA using Safari, where it is installable from the share, add to the home screen menu" (web.dev, n.d.-a), while MDN says that since iOS 16.4 the Share menu also offers it in Chrome, Edge, Firefox and Orion (MDN Contributors, n.d.-a); the two pages disagree, and the hint in the footer works in Safari in both. Since Safari 26: "By default, every website added to the Home Screen opens as a web app", and "they can turn off 'Open as Web App'" to keep a bookmark that opens in the default browser (WebKit, n.d.).

## 3. Options

| Option                                      | What it is                                                                          | For                                                         | Against                                                                                                                                              |
| ------------------------------------------- | ----------------------------------------------------------------------------------- | ----------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| A. Manifest, icons and an install button    | The files that make the site installable, and a button where the browser can prompt | Small; no new moving parts; nothing is cached on the device | No offline use: the installed app needs a network, like the site                                                                                     |
| B. A and a service worker with an app shell | A also caches the pages and files for use without a network                         | Works offline                                               | Stale caches and versioning; interplay with the analysis worker, the Overpass cache and the on-device model; its own decisions, so an ADR of its own |
| C. Nothing; a person can bookmark the site  | No change                                                                           | No work                                                     | No icon of its own and no window of its own, which is what the issue asks for                                                                        |

## 4. Decision

Option A, in this form:

- **The manifest** is `public/manifest.webmanifest`. `start_url` and `scope` are relative (`./`), so that a change of the base path of the site does not break them. The display mode is `standalone`.
- **The icons** are made from the square icon of the site, `src/assets/tigerlegs-icon.png`, by `npm run icons` (`src/build-icons.ts`, with `sharp`), and committed to `public/img/icons/`, where they have a fixed URL: 192 and 512 pixels, a maskable icon of 512 pixels, and an `apple-touch-icon` of 180 pixels without transparency, because iOS fills transparency with black.
- **The maskable icon** follows MDN: "The safe zone is the area that's guaranteed to always be visible when the mask is applied and is defined as a circle which diameter is 80% of the icon's minimum dimension", and the icon has "an opaque background color to fill the entire icon area" (MDN Contributors, n.d.-b). The ears of the tiger are the corners of the picture, so the picture is scaled to 70% on white.
- **The layout** links the manifest and the apple touch icon and sets a theme colour and the name for the iOS home screen.
- **The button** is in the footer and is only there when something can be done: on a Chromium browser, after `beforeinstallprompt`, it shows the prompt of the browser; on iOS it explains the Share menu. It never shows itself, so there is nothing that nags, and it has a text label in the four languages. Nothing is stored for it.
- **The event is kept from the start.** The browser fires it once, and the footer button may come later, so a small store is made when the page loads (`src/client/install.ts`) and keeps the event across page changes. An event can be used once, so after a use the store throws it away, as web.dev advises (web.dev, n.d.-b), and the button is gone until the browser fires a new event, which Chrome typically does right after a dismissal; the store listens for it, and the button comes back. The browser's own mini infobar is held back with `preventDefault`, as MDN describes, so the button is the only invitation and nothing nags.
- **"Already an app"** is read from the `(display-mode: standalone)` media query, which tests "whether a web app is being displayed in a normal browser tab or in some alternative way, such as a standalone app or fullscreen mode" (MDN Contributors, n.d.-c), and, for iOS, from `navigator.standalone`, which the MDN page that we read does not cover. Then no button is shown.

## 5. Consequences

- There is no offline use. The installed app opens the site, so without a network the browser shows its own offline page. Offline use is a separate issue and ADR (option B).
- Open: a page of its own that the footer link leads to, which explains what an installed app is and gives the steps per platform (the button for the prompt on Android, the Share menu with room for pictures on iOS). That would suit iOS best, where the page can only explain, and it matches the advice to wait until a person "has demonstrated interest" (web.dev, n.d.-c). It is not built; it is a candidate for a follow-up.
- The browser tests cover the manifest, the icons, the links in the head, the button with a synthetic `beforeinstallprompt` event, the language of the button, and the explanation with an iPhone user agent. They do not install anything: that needs a real Android phone and a real iPhone.
- The names of the menu items on iOS in the hint ("Add to Home Screen" and its Dutch, French and German versions) are written from memory of the iOS menus and have to be checked on a device.
- The manifest is served as `application/manifest+json` by the test server; the real host has to do the same, or at least serve it with a type that the browsers accept.
- The theme colour `#fbbf24` approximates the amber of the header; change it when the header changes.
- Revisit when offline use is wanted, when the base path changes, or when a browser asks for more than the criteria above.

## References

- MDN Contributors. (n.d.-a). *Making PWAs installable*. MDN Web Docs. Retrieved November 16, 2026, from https://developer.mozilla.org/en-US/docs/Web/Progressive_web_apps/Guides/Making_PWAs_installable
- MDN Contributors. (n.d.-b). *How to define app icons*. MDN Web Docs. Retrieved November 16, 2026, from https://developer.mozilla.org/en-US/docs/Web/Progressive_web_apps/How_to/Define_app_icons
- MDN Contributors. (n.d.-c). *display-mode*. MDN Web Docs. Retrieved November 16, 2026, from https://developer.mozilla.org/en-US/docs/Web/CSS/@media/display-mode
- MDN Contributors. (n.d.-d). *BeforeInstallPromptEvent: prompt() method*. MDN Web Docs. Retrieved November 16, 2026, from https://developer.mozilla.org/en-US/docs/Web/API/BeforeInstallPromptEvent/prompt
- web.dev. (n.d.-a). *Installation prompt*. Google. Retrieved November 16, 2026, from https://web.dev/learn/pwa/installation-prompt
- web.dev. (n.d.-b). *How to provide your own in-app install experience*. Google. Retrieved November 16, 2026, from https://web.dev/articles/customize-install
- web.dev. (n.d.-c). *Patterns for promoting PWA installation*. Google. Retrieved November 16, 2026, from https://web.dev/articles/promote-install
- Chrome for Developers. (n.d.). *Changes to add to home screen behavior*. Google. Retrieved November 16, 2026, from https://developer.chrome.com/blog/a2hs-updates
- WebKit. (n.d.). *News from WWDC25: Web technology coming this fall in Safari 26 beta*. WebKit Blog. Retrieved November 16, 2026, from https://webkit.org/blog/16993/news-from-wwdc25-web-technology-coming-this-fall-in-safari-26-beta/
