import { test, expect } from "@playwright/test";
import { readFile, readdir } from "node:fs/promises";
import { resolve } from "node:path";

test.beforeEach(async ({ page }) => {
  await page.route("**/*", route => {
    if (new URL(route.request().url()).hostname === "127.0.0.1") return route.continue();
    return route.abort();
  });
});

test("static pages and every ADR have shared navigation, direct links and reloads", async ({ page, request }) => {
  const names = (await readdir("docs/adr")).filter(name => name.endsWith(".md"));
  for (const path of ["", "training.html", "about.html", "guidebook.html", ...names.map(name => `adr/${name.slice(0, -3)}.html`)]) {
    await page.goto(path || "./");
    await expect(page.locator("#main-menu a")).toHaveText(["Extractorrr", "Training", "About", "Guidebook"]);
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
  await expect(page.locator("#totals-row")).toContainText("1050");
  const buttons = page.locator(".segment-select");
  await buttons.first().focus();
  await page.keyboard.press("Enter");
  await expect(page.locator('[aria-pressed="true"]')).toHaveCount(1);
  await expect(page.locator('.leaflet-overlay-pane path[stroke-width="8"]')).toHaveCount(1);
  await page.keyboard.press("Escape");
  await expect(page.locator('[aria-pressed="true"]')).toHaveCount(0);
  await buttons.first().click();
  await buttons.first().click();
  await expect(page.locator('[aria-pressed="true"]')).toHaveCount(0);
  await page.locator("#show-cumulative").check();
  await expect(page.locator(".leaflet-control-layers")).toHaveCount(1);
  await expect(page.locator("thead")).toContainText("Cumulative (km)");
  await page.locator("#swim-first").check();
  expect(await page.locator("thead th").nth(1).textContent()).toBe("Swim (m)");
  expect(await page.locator("tbody td").evaluateAll(cells => cells.every(cell => !!cell.textContent?.trim()))).toBe(true);
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
  await page.locator('[data-sample="rhederlaag-swimrun.gpx"]').click();
  await expect(page.locator("#analysis-status")).toContainText("Analysed");
  expect(requests).toBe(0);
  await page.locator("#use-terrain").check();
  await expect(page.locator("#terrain-warning")).toContainText("coarse bounding box");
  await expect(page.locator("#message")).toContainText("Terrain data unavailable", { timeout: 15000 });
  expect(requests).toBeGreaterThan(0);
  await expect(page.locator("#totals-row")).toContainText("1050");
  await page.locator("#use-terrain").uncheck();
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
  await page.locator('[data-sample="rhederlaag-swimrun.gpx"]').click();
  await expect(page.locator("#analysis-status")).toContainText("Analysed");
  await page.locator("#use-terrain").check();
  await expect(page.locator("#totals")).toContainText("landscape");
  await expect(page.locator("#message")).toBeEmpty();
  await expect(page.locator(".leaflet-control-layers")).toHaveCount(1);
});

test("chatbot loads the FAQ, shows a typing indicator and answers", async ({ page }) => {
  const label = "But can tigers actually swim?";
  await page.goto("./");
  await page.locator("#chat-title").scrollIntoViewIfNeeded();
  await expect(page.getByRole("button", { name: label })).toHaveCount(0);
  await page.getByRole("button", { name: /Ask the tiger/ }).click();
  await page.getByRole("button", { name: label }).click();
  const chat = page.getByRole("region", { name: /Ask the tiger/ });
  await expect(chat.getByRole("status")).toContainText("typing");
  await expect(page.getByRole("log")).toContainText("Tigers are among the few big cats");
  await expect(chat.getByRole("status")).toHaveCount(0);
  await expect(chat.getByRole("button", { name: label })).toBeVisible();
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
  await page.getByRole("button", { name: /Vraag het de tijger/ }).click();
  await expect(page.getByRole("list", { name: "Voorgestelde vragen" })).toBeVisible();
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
