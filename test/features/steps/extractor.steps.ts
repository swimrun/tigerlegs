import { createBdd } from "playwright-bdd";
import { test } from "./fixtures.ts";
import { expect } from "@playwright/test";
import { resolve } from "node:path";

const { Given, When, Then } = createBdd(test);

const terrainRequests = { count: 0 };

Given("the Extractor page on a laptop screen of {int} by {int}", async ({ page }, width: number, height: number) => {
  terrainRequests.count = 0;
  await page.setViewportSize({ width, height });
  await page.goto("./");
});

Given("the terrain service answers {string}", async ({ page }, answer: string) => {
  await page.route("**/api/interpreter", (route) => {
    terrainRequests.count++;
    return route.fulfill({ status: answer === "unavailable" ? 503 : 200, body: answer });
  });
});

Given("I have opened the sample menu", async ({ page }) => {
  await page.locator("[data-sample-menu] summary").click();
});

When("it has loaded", async ({ page }) => {
  await expect(page.locator("#map")).toBeVisible();
});

When("I open the sample menu", async ({ page }) => {
  await page.locator("[data-sample-menu] summary").click();
});

When("I choose the variant {string} of the course {string}", async ({ page }, variant: string, course: string) => {
  await page.locator(`[data-course="${course}"] select`).selectOption({ label: variant });
});

When("I upload the file {string}", async ({ page }, file: string) => {
  await page.locator("#gpx-input").setInputFiles(resolve(file));
  await expect(page.locator("#analysis-status")).toContainText("Analysed", { timeout: 15000 });
});

When("I answer {string}", async ({ page }, answer: string) => {
  await page.getByRole("button", { name: answer }).click();
});

Then("at least {int} pixels of the map are visible without scrolling", async ({ page }, pixels: number) => {
  const viewport = page.viewportSize()!;
  const map = await page.locator("#map").boundingBox();
  expect(map, "the map exists").not.toBeNull();
  expect(map!.y + pixels, `the map starts at ${Math.round(map!.y)} px`).toBeLessThanOrEqual(viewport.height);
});

Then("the sample menu is closed", async ({ page }) => {
  await expect(page.locator("[data-sample-menu]")).not.toHaveAttribute("open", "");
});

Then("I can choose a sample", async ({ page }) => {
  await expect(page.locator("[data-sample-menu] a[data-sample], [data-sample-menu] button[data-sample]").first()).toBeVisible();
});

Then("the description of the course {string} mentions {string}", async ({ page }, course: string, text: string) => {
  await expect(page.locator(`[data-course="${course}"] [data-variant-description]`)).toContainText(text);
});

Then("the Load button of the course {string} is disabled", async ({ page }, course: string) => {
  await expect(page.locator(`[data-course="${course}"]`).getByRole("button", { name: "Load" })).toBeDisabled();
});

Then("the terrain question is shown with what is sent", async ({ page }) => {
  await expect(page.locator("#terrain-dialog")).toBeVisible();
  await expect(page.locator("#terrain-sent")).toContainText("coarse bounding box");
});

Then("the terrain question is closed", async ({ page }) => {
  await expect(page.locator("#terrain-dialog")).not.toBeVisible();
});

Then("no request went to the terrain service", async () => {
  expect(terrainRequests.count).toBe(0);
});
