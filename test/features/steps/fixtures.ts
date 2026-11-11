import { test as base } from "playwright-bdd";

/** Only the local site is reachable in tests: map tiles and the real terrain service are blocked. */
export const test = base.extend<{ localOnly: void }>({
  localOnly: [async ({ page }, use) => {
    await page.route("**/*", (route) => {
      if (new URL(route.request().url()).hostname === "127.0.0.1") return route.continue();
      return route.abort();
    });
    await use();
  }, { auto: true }],
});
