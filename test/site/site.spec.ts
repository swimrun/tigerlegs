import { test, expect, type Page } from "@playwright/test";
import { readFile, readdir } from "node:fs/promises";
import { resolve } from "node:path";
import { STRINGS as CHAT_STRINGS } from "../../src/client/chat.strings.ts";
import { STRINGS as TRAINING_STRINGS } from "../../src/components/TrainingWeek.strings.ts";
import { SITE_BROWSERS } from "../user-agents.ts";

test.beforeEach(async ({ page }) => {
  await page.route("**/*", route => {
    if (new URL(route.request().url()).hostname === "127.0.0.1") return route.continue();
    return route.abort();
  });
});

/** Terrain data is asked for in a dialog, when it matters; this answers yes after the analysis. */
async function enableTerrain(page: Page) {
  await page.locator("#terrain-ask").click();
  await page.locator("#use-terrain").click();
}

/** The sample menu is a closed details element, so that the upload leads the page. */
async function openSamples(page: Page) {
  await page.locator("[data-sample-menu] summary").click();
}

test("static pages and every ADR have shared navigation, direct links and reloads", async ({ page, request }) => {
  const names = (await readdir("docs/adr")).filter(name => name.endsWith(".md"));
  for (const path of ["", "training.html", "pricing.html", "about.html", "guidebook.html", ...names.map(name => `adr/${name.slice(0, -3)}.html`)]) {
    await page.goto(path || "./");
    await expect(page.locator("#main-menu a")).toHaveText(["Extractorrr", "Training", "Pricing", "About", "Guidebook"]);
    await expect(page.locator("#main-menu [aria-current=page]")).toHaveCount(1);
    await page.reload();
    await expect(page.locator("main")).toBeVisible();
  }
  await page.goto("guidebook.html#13-decision-log");
  await expect(page.locator('[id="13-decision-log"]')).toBeVisible();
  const links = await page.locator('main a[href*="/adr/"]').evaluateAll(elements => elements.map(element => element.getAttribute("href")!));
  expect(new Set(links).size).toBeGreaterThanOrEqual(9);
  for (const link of links) expect((await request.get(link)).status()).toBe(200);
  for (const path of ["analysis-worker.js", "samples/ruegen-swimrun.gpx", "img/tigerlegs-pair.jpg", "styles.css"]) {
    expect((await request.get(path)).status()).toBe(200);
  }
  expect((await request.get("not-a-route.html")).status()).toBe(404);
});

test("language choice is in the header on every page and persists across pages", async ({ page }) => {
  await page.goto("./");
  await expect(page.locator("#language-switch option")).toHaveCount(4);
  // Regression: the language-hiding CSS must not hide the dropdown's own options.
  const optionDisplays = await page.locator("#language-switch option")
    .evaluateAll(options => options.map(option => getComputedStyle(option).display));
  for (const display of optionDisplays) expect(display).not.toBe("none");
  await page.locator("#language-switch").selectOption("nl");
  await expect(page.locator("html")).toHaveAttribute("lang", "nl");
  await page.goto("about.html");
  await expect(page.locator("html")).toHaveAttribute("lang", "nl");
  await expect(page.locator("h1[lang=nl]")).toBeVisible();
  await expect(page.locator("#language-switch")).toHaveValue("nl");
});

test("fake login shows the static profile and logging out returns to the form", async ({ page }) => {
  await page.goto("profile.html");
  await page.getByRole("button", { name: "Log in" }).click();
  await expect(page.getByRole("heading", { name: "Bart van der Wal" })).toBeVisible();
  await page.reload();
  await expect(page.getByRole("heading", { name: "Bart van der Wal" })).toBeVisible();
  await page.getByRole("button", { name: "Log out" }).click();
  await expect(page.getByRole("button", { name: "Log in" })).toBeVisible();
});

test("documentation works without JavaScript", async ({ browser }) => {
  const context = await browser.newContext({ javaScriptEnabled: false });
  const page = await context.newPage();
  await page.goto("http://127.0.0.1:8784/tigerlegs/guidebook.html");
  await expect(page.locator('[id="13-decision-log"]')).toBeVisible();
  await expect(page.locator('a[href$="0009-react-for-interactive-frontend.html"]')).toBeVisible();
  await context.close();
});

test("React import, paired table, keyboard selection and presentation controls preserve results", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", error => errors.push(error.message));
  await page.goto("./");
  await page.locator("#gpx-input").setInputFiles(resolve("test-data/rhederlaag-swimrun.gpx"));
  await expect(page.locator("#analysis-status")).toContainText("Analysed", { timeout: 15000 });
  await page.locator("#keep-local").click();
  await expect(page.locator("#totals-row")).toContainText("2450");
  const buttons = page.locator(".segment-select");
  await buttons.first().focus();
  await page.keyboard.press("Enter");
  await expect(page.locator('.segment-select[aria-pressed="true"]')).toHaveCount(1);
  await expect(page.locator('.leaflet-overlay-pane path[stroke-width="8"]')).toHaveCount(1);
  await page.keyboard.press("Escape");
  await expect(page.locator('.segment-select[aria-pressed="true"]')).toHaveCount(0);
  await buttons.first().click();
  await buttons.first().click();
  await expect(page.locator('.segment-select[aria-pressed="true"]')).toHaveCount(0);
  await page.locator("#show-cumulative").check({ force: true });
  await expect(page.locator(".leaflet-control-layers")).toHaveCount(1);
  await expect(page.locator("thead")).toContainText("Total so far (km)");
  await page.locator("#swim-first").check();
  expect(await page.locator("thead th").nth(1).textContent()).toBe("Swim (m)");
  expect(await page.locator("tbody td").evaluateAll(cells => cells.every(cell => !!cell.textContent?.trim()))).toBe(true);
  await page.locator("summary", { hasText: "Local strategies" }).click();
  await page.locator("#use-waypoints").uncheck();
  await page.locator("#use-speed").click();
  await expect(page.locator("#use-speed")).toBeChecked();
  await expect(page.locator("#message")).toContainText("At least one");
  expect(errors).toEqual([]);
});

test("multi-track choice, large-point confirmation and Worker analysis", async ({ page }) => {
  await page.goto("./");
  await page.locator("#gpx-input").setInputFiles(resolve("test/fixtures/upload-multiple-tracks.gpx"));
  await expect(page.locator("#track-picker")).toBeVisible();
  await expect(page.locator("#analysis-status")).toContainText("Choose a track");
  await page.locator("#track-select").selectOption("1");
  await expect(page.locator("#analysis-status")).toContainText("Analysed");
  await openSamples(page);
  await page.locator('[data-sample="ruegen-swimrun.gpx"]').click();
  await expect(page.locator("#analysis-status")).toContainText("background worker", { timeout: 15000 });
  await expect(page.locator("#analysis-status")).toContainText("Analysed");
  const before = await page.locator("#totals").textContent();
  const trackpoint = '<trkpt lat="52" lon="4"><time>2024-01-01T00:00:00Z</time></trkpt>';
  const large = `<?xml version="1.0"?><gpx version="1.1" creator="test"><trk><name>Large</name><trkseg>${trackpoint.repeat(50001)}</trkseg></trk></gpx>`;
  page.once("dialog", dialog => dialog.dismiss());
  await page.locator("#gpx-input").setInputFiles({ name: "large.gpx", mimeType: "application/gpx+xml", buffer: Buffer.from(large) });
  await expect(page.locator("#analysis-status")).toContainText("Import cancelled", { timeout: 20000 });
  expect(await page.locator("#totals").textContent()).toBe(before);
});

test("terrain requires opt-in and failure retains local analysis", async ({ page }) => {
  let requests = 0;
  await page.route("**/api/interpreter", route => {
    requests++;
    return route.fulfill({ status: 503, body: "Unavailable" });
  });

  await page.goto("./");
  await openSamples(page);
  await page.locator('[data-sample="rhederlaag-swimrun.gpx"]').click();
  await expect(page.locator("#analysis-status")).toContainText("Analysed");
  expect(requests).toBe(0);
  await enableTerrain(page);
  await expect(page.locator("#terrain-warning")).toContainText("coarse bounding box");
  await expect(page.locator("#message")).toContainText("Terrain data unavailable", { timeout: 15000 });
  expect(requests).toBeGreaterThan(0);
  await expect(page.locator("#totals-row")).toContainText("2450");
  await page.locator("#terrain-off").click();
  await expect(page.locator("#terrain-warning")).toHaveCount(0);
});

test("drop uses the same track chooser and mapped terrain refines local results", async ({ page }) => {
  const fixture = await readFile("test/fixtures/upload-multiple-tracks.gpx", "utf8");
  await page.goto("./");
  await expect(page.locator(".leaflet-control-layers")).toHaveCount(1);
  await page.evaluate(xml => {
    const data = new DataTransfer();
    data.items.add(new File([xml], "dropped.gpx", { type: "application/gpx+xml" }));
    document.getElementById("drop-zone")!.dispatchEvent(new DragEvent("drop", { dataTransfer: data, bubbles: true }));
  }, fixture);
  await expect(page.locator("#track-picker")).toBeVisible();
  await expect(page.locator("#analysis-status")).toContainText("Choose a track");
  const water = await readFile("test/fixtures/rhederlaag-overpass.json", "utf8");
  await page.route("**/api/interpreter", route => route.fulfill({ contentType: "application/json", body: water }));
  await openSamples(page);
  await page.locator('[data-sample="rhederlaag-swimrun.gpx"]').click();
  await expect(page.locator("#analysis-status")).toContainText("Analysed");
  await enableTerrain(page);
  await expect(page.locator("#totals")).toContainText("landscape");
  await expect(page.locator("#message")).toBeEmpty();
  await expect(page.locator(".leaflet-control-layers")).toHaveCount(1);
});

test("chatbot loads the FAQ, shows a typing indicator and answers", async ({ page }) => {
  const label = "But can tigers actually swim?";
  await page.goto("./");
  await page.locator("#chat-title").scrollIntoViewIfNeeded();
  await expect(page.getByRole("button", { name: label })).toHaveCount(0);
  await expect(page.locator("#chat-title img"), "the chat header shows the ROARRS avatar").toBeVisible();
  await page.getByRole("button", { name: /ROARRS: Robotic Operating Agent that Responds to Requests about Swimrun/ }).click();
  await page.getByRole("button", { name: label }).click();
  const chat = page.getByRole("region", { name: /ROARRS: Robotic Operating Agent that Responds to Requests about Swimrun/ });
  await expect(chat.getByRole("status")).toContainText("typing");
  await expect(page.getByRole("log")).toContainText("Tigers are among the few big cats");
  await expect(chat.getByRole("status")).toHaveCount(0);
  await expect(chat.getByRole("button", { name: label }), "a chosen question disappears at once").toHaveCount(0);
  await expect(chat.getByRole("button", { name: "Tell me more" })).toBeVisible();
  await chat.getByRole("button", { name: "Tell me more" }).click();
  await expect(page.getByRole("log")).toContainText("They cool off in it");
  await expect(chat.getByRole("button", { name: label })).toHaveCount(0);
  await expect(chat.getByRole("button", { name: "Tell me more" })).toHaveCount(0);
  await page.getByLabel("Your question").fill("Which wetsuit?");
  await page.getByRole("button", { name: "Ask", exact: true }).click();
  await expect(page.getByRole("log")).toContainText("There is no actual LLM integration yet");
});

test("chatbot follows the page language", async ({ page }) => {
  await page.goto("./");
  await page.locator("#chat-title").scrollIntoViewIfNeeded();
  await page.locator("#language-switch").selectOption("nl");
  await page.getByRole("button", { name: /ROARRS: Robotic Operating Agent that Responds to Requests about Swimrun/ }).click();
  await expect(page.getByRole("list", { name: "Voorgestelde vragen" })).toBeVisible();
});

test("the chat keeps its conversation across pages and takes the agent of the page", async ({ page }) => {
  await page.goto("./");
  await page.evaluate(() => (globalThis as { __noReload?: boolean }).__noReload = true);
  await page.getByRole("button", { name: /ROARRS: Robotic Operating Agent that Responds to Requests about Swimrun/ }).click();
  await page.getByRole("button", { name: "But can tigers actually swim?" }).click();
  await expect(page.getByRole("log")).toContainText("Tigers are among the few big cats");

  await page.getByRole("navigation", { name: "Main menu" }).getByRole("link", { name: "Training" }).click();
  await expect(page).toHaveURL(/training\.html$/);
  await expect(page.getByRole("heading", { name: "Training", level: 1 })).toBeVisible();
  // Same document (no full reload), same conversation, but now the training agent.
  expect(await page.evaluate(() => (globalThis as { __noReload?: boolean }).__noReload)).toBe(true);
  await expect(page.getByRole("log")).toContainText("Tigers are among the few big cats");
  await expect(page.getByRole("button", { name: /ROARRS: Robotic Operating Agent that Responds to Requests about Swimrun/ })).toBeVisible();
  await expect(page.getByPlaceholder(/travelling/)).toBeVisible();

  await page.getByRole("navigation", { name: "Main menu" }).getByRole("link", { name: "About" }).click();
  await expect(page).toHaveURL(/about\.html$/);
  await expect(page.getByRole("button", { name: /ROARRS: Robotic Operating Agent that Responds to Requests about Swimrun/ })).toBeVisible();
  await expect(page.getByRole("log")).toContainText("Tigers are among the few big cats");
  // The language survives the swap and the language switch is still bound in the new header.
  await page.locator("#language-switch").selectOption("nl");
  await expect(page.getByRole("button", { name: /ROARRS: Robotic Operating Agent that Responds to Requests about Swimrun/ })).toBeVisible();
});

test("About translations and mobile layout survive the shared shell", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("about.html");
  await page.locator("#language-switch").selectOption("nl");
  await expect(page.locator("html")).toHaveAttribute("lang", "nl");
  await expect(page.getByRole("heading", { name: "Over TigerLegs" })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.goto("./");
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

test("the extractor offers the variants of a course in a dropdown with a description and loads one that has a GPX file", async ({ page }) => {
  await page.goto("./");
  await expect(page.locator("[data-sample-menu]")).not.toHaveAttribute("open", "");
  await openSamples(page);
  const rondje = page.locator('[data-course="rondje-eilanden"]');
  await expect(rondje.locator("option")).toHaveCount(3);
  await expect(rondje.locator("[data-variant-description]")).toContainText("Main variant");
  await expect(rondje.locator("[data-variant-description]")).toContainText("swim A of about 400 m");
  await rondje.locator("select").selectOption("lintjes-opruimen");
  await expect(rondje.locator("[data-variant-description]")).toContainText("island 3 to 5");
  await rondje.locator("select").selectOption("training");
  await expect(rondje.locator("[data-variant-description]")).toContainText("GPX to be added");
  await expect(rondje.getByRole("button", { name: "Load" })).toBeDisabled();
  const rhederlaag = page.locator('[data-course="rhederlaag"]');
  await expect(rhederlaag.locator("option")).toHaveCount(4);
  await rhederlaag.locator("select").selectOption("bird-breeding-season");
  await expect(rhederlaag.locator("[data-variant-description]")).toContainText("April to June");
  await rondje.locator("select").selectOption("race-day");
  await rondje.getByRole("button", { name: "Load" }).click();
  await expect(page.locator("#analysis-status")).toContainText("Analysed");
  await rondje.locator("select").selectOption("lintjes-opruimen");
  await expect(page.locator("#analysis-status")).toContainText("Analysed");
  await rondje.getByRole("button", { name: "Load" }).click();
  await expect(page.locator("#analysis-status")).toContainText("Analysed");
});


test("the site is installable: a manifest with icons, an apple touch icon and a theme colour on every page", async ({ page }) => {
  for (const path of ["./", "training.html", "about.html"]) {
    await page.goto(path);
    await expect(page.locator('link[rel="manifest"]'), path).toHaveAttribute("href", /manifest\.webmanifest$/);
    await expect(page.locator('link[rel="apple-touch-icon"]'), path).toHaveAttribute("href", /apple-touch-icon\.png$/);
    await expect(page.locator('meta[name="theme-color"]'), path).toHaveAttribute("content", /^#[0-9a-f]{6}$/i);
  }
  await page.goto("./");
  const manifestUrl = new URL((await page.locator('link[rel="manifest"]').getAttribute("href")) ?? "", page.url()).href;
  const response = await page.request.get(manifestUrl);
  expect(response.ok()).toBeTruthy();
  expect(response.headers()["content-type"]).toContain("manifest+json");
  const manifest = await response.json();
  expect(new URL(manifest.start_url, manifestUrl).href, "the app starts at the home page of the site").toBe(new URL("./", manifestUrl).href);
  expect(manifest.display).toBe("standalone");
  for (const icon of manifest.icons) {
    const file = await page.request.get(new URL(icon.src, manifestUrl).href);
    expect(file.ok(), icon.src).toBeTruthy();
    expect(file.headers()["content-type"], icon.src).toBe("image/png");
  }
  const apple = await page.request.get(new URL((await page.locator('link[rel="apple-touch-icon"]').getAttribute("href")) ?? "", page.url()).href);
  expect(apple.ok()).toBeTruthy();
});

type InstallTestWindow = { prompted?: boolean; offered?: boolean };

/** Fires the event that a Chromium browser fires when the site can be installed. */
async function offerInstall(page: Page) {
  await page.evaluate(() => {
    const event = new Event("beforeinstallprompt", { cancelable: true });
    Object.assign(event, {
      prompt: async () => {
        (window as unknown as InstallTestWindow).prompted = true;
      },
      userChoice: Promise.resolve({ outcome: "dismissed" }),
    });
    // dispatchEvent answers false when a listener called preventDefault, which holds the browser's own prompt back.
    (window as unknown as InstallTestWindow).offered = window.dispatchEvent(event);
  });
}

test("the install button appears when the browser offers the prompt, holds back the browser's own, and is used up", async ({ page }) => {
  await page.goto("./");
  const footer = page.locator("footer");
  await expect(footer.getByRole("button", { name: "Install app" }), "nothing is shown until the browser offers it").toHaveCount(0);
  await offerInstall(page);
  const button = footer.getByRole("button", { name: "Install app" });
  await expect(button).toBeVisible();
  expect(await page.evaluate(() => (window as unknown as InstallTestWindow).offered)).toBe(false);
  await button.click();
  await expect.poll(() => page.evaluate(() => (window as unknown as InstallTestWindow).prompted)).toBe(true);
  await expect(footer.getByRole("button", { name: "Install app" })).toHaveCount(0);
});

test("the install button stays when the person goes to another page, and speaks the page language", async ({ page }) => {
  await page.goto("./");
  await offerInstall(page);
  await expect(page.locator("footer").getByRole("button", { name: "Install app" })).toBeVisible();
  await page.getByRole("navigation", { name: "Main menu" }).getByRole("link", { name: "Training" }).click();
  await expect(page).toHaveURL(/training\.html$/);
  await expect(page.locator("footer").getByRole("button", { name: "Install app" }), "the event was kept for the next page").toBeVisible();
  await page.locator("#language-switch").selectOption("nl");
  await expect(page.locator("footer").getByRole("button", { name: "Installeer de app" })).toBeVisible();
});

test.describe("on an iPhone", () => {
  test.use({
    userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1",
  });

  test("the footer explains how to add the site to the home screen, because iOS has no install prompt", async ({ page }) => {
    await page.goto("./");
    const button = page.locator("footer").getByRole("button", { name: "Add to home screen" });
    await expect(button).toHaveAttribute("aria-expanded", "false");
    await expect(page.getByText("Tap the Share button")).toBeHidden();
    await button.click();
    await expect(button).toHaveAttribute("aria-expanded", "true");
    await expect(page.getByText("Tap the Share button, then “Add to Home Screen”.")).toBeVisible();
  });
});

const ROARRS = /ROARRS: Robotic Operating Agent that Responds to Requests about Swimrun/;

/** A free question in the chat, typed as a person does: the labels of the field and the button are those of the language. */
async function askFreely(page: Page, lang: "en" | "nl", question: string) {
  const t = CHAT_STRINGS[lang];
  await page.getByRole("button", { name: ROARRS }).click();
  await page.getByLabel(t.yourQuestion).fill(question);
  await page.getByRole("button", { name: t.ask, exact: true }).click();
}

// The FAQ chat has no model yet. In a language that Gemini Nano accepts it gives the fallback of the FAQ, whatever the
// browser; in Dutch it says why a free question does not work, and that depends on the browser (chat-hints.ts).
for (const { name, userAgent, chrome } of SITE_BROWSERS) {
  test.describe(`the FAQ chat in ${name}`, () => {
    test.use({ userAgent });

    test("English: a free question gets the fallback of the FAQ, which points to the Training page", async ({ page }) => {
      await page.goto("./");
      await askFreely(page, "en", "Which wetsuit?");
      await expect(page.getByRole("log")).toContainText("There is no actual LLM integration yet");
      await expect(page.getByRole("log")).toContainText("Training page");
    });

    test("Dutch: a free question gets the reason that it does not work here", async ({ page }) => {
      await page.goto("./");
      await page.locator("#language-switch").selectOption("nl");
      await askFreely(page, "nl", "Welk wetsuit?");
      await expect(page.getByRole("log")).toContainText(chrome ? CHAT_STRINGS.nl.useSupportedLanguage ?? "" : CHAT_STRINGS.nl.switchToChrome);
    });
  });
}

// The training chat does use the model, so there the browser matters in every language. The test browser has no
// Prompt API, which is made explicit so that a Chromium that gets one cannot change the result.
for (const { name, userAgent, chrome } of SITE_BROWSERS.filter((browser) => ["Chrome on macOS", "Safari on macOS", "Firefox"].includes(browser.name))) {
  for (const lang of ["en", "nl"] as const) {
    test.describe(`the training chat in ${name}, in ${lang}`, () => {
      test.use({ userAgent });

      test("a free instruction is answered with the reason that fits this browser and language", async ({ page }) => {
        await page.addInitScript(() => Object.defineProperty(globalThis, "LanguageModel", { value: undefined, configurable: true }));
        await page.goto("training.html");
        if (lang !== "en") await page.locator("#language-switch").selectOption(lang);
        await askFreely(page, lang, "Move my run to Friday");
        const expected = !chrome
          ? CHAT_STRINGS[lang].switchToChrome
          : lang === "nl"
          ? CHAT_STRINGS.nl.useSupportedLanguage ?? ""
          : TRAINING_STRINGS.en.assistAbsent;
        await expect(page.getByRole("log")).toContainText(expected);
      });
    });
  }
}

type Box = { x: number; y: number; width: number; height: number };
const overlap = (a: Box, b: Box) => a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height;

test("the sports rest day picker follows the plan levers in the flow, and its menu opens from itself and stays clear of the chat", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto("training.html");
  const levers = (await page.getByRole("region", { name: "Plan levers" }).boundingBox())!;
  const generate = (await page.getByRole("button", { name: "Generate week" }).boundingBox())!;
  const picker = page.locator("[data-rest-days]");
  const pickerBox = (await picker.boundingBox())!;

  expect(pickerBox.x, "to the right of the Generate button").toBeGreaterThan(generate.x + generate.width);
  expect(pickerBox.x - (generate.x + generate.width), "in the flow, next to the button").toBeLessThan(40);
  expect(levers.x + levers.width - (pickerBox.x + pickerBox.width), "not pushed against the right edge").toBeGreaterThan(100);

  await picker.locator("summary").click();
  const menu = (await picker.getByRole("group", { name: "Sports rest days" }).boundingBox())!;
  expect(Math.abs(menu.x - pickerBox.x), "the menu starts where the picker starts").toBeLessThan(2);

  const chat = (await page.getByRole("region", { name: ROARRS }).boundingBox())!;
  expect(overlap(menu, chat), "the open menu does not run under the chat").toBe(false);
  expect(overlap(pickerBox, chat), "the picker does not run under the chat").toBe(false);
});

test("every session in the week has an icon beside its title, and the open-water swim has the waves", async ({ page }) => {
  await page.goto("training.html");
  const sessions = page.locator("[data-session]");
  const count = await sessions.count();
  expect(count).toBeGreaterThan(0);
  await expect(page.locator("[data-session] [data-icon]"), "one icon for every session").toHaveCount(count);
  await expect(page.locator('[data-session="swim-1"] [data-icon]')).toHaveAttribute("data-icon", "swim-open");
  await expect(page.locator('[data-session="run-1"] [data-icon]')).toHaveAttribute("data-icon", "run");
  await expect(page.locator("[data-icon]").first(), "decoration, skipped by a screen reader").toHaveAttribute("aria-hidden", "true");
});

/** How many lines of text an element holds: its height divided by its line height. */
async function lines(locator: ReturnType<Page["locator"]>) {
  return await locator.evaluate((element) => element.getBoundingClientRect().height / parseFloat(getComputedStyle(element).lineHeight));
}

test("the title of the chat window is the name above a smaller expansion: two lines on a desktop, at most three on a phone", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 720 });
  await page.goto("./");
  const name = page.locator("[data-chat-name]");
  const expansion = page.locator("[data-chat-expansion]");
  const size = (locator: ReturnType<Page["locator"]>) => locator.evaluate((element) => parseFloat(getComputedStyle(element).fontSize));

  expect(await size(expansion), "the expansion has smaller letters than the name").toBeLessThan(await size(name));
  expect(await lines(name), "the name is one line").toBeLessThan(1.5);
  expect(await lines(expansion), "the expansion is one line on a desktop").toBeLessThan(1.5);
  await expect(page.getByRole("button", { name: ROARRS }), "a screen reader still gets the whole title").toBeVisible();

  await page.setViewportSize({ width: 390, height: 700 });
  expect(await lines(expansion), "the expansion is at most two lines on a phone").toBeLessThan(2.5);
});
