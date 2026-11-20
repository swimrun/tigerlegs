import { createBdd } from "playwright-bdd";
import { expect } from "@playwright/test";
import { test } from "./fixtures.ts";

const { Given, When, Then } = createBdd(test);

Given("the Pricing page", async ({ page }) => {
  await page.goto("pricing.html");
});

Then("the main menu has the link {string} marked as the current page", async ({ page }, name: string) => {
  await expect(page.locator("#main-menu").getByRole("link", { name })).toHaveAttribute("aria-current", "page");
});

Then("the page says that TigerLegs is under development, looking for testers and completely free", async ({ page }) => {
  const status = page.locator('main > div[lang="en"] [data-status]');
  await expect(status).toContainText("under development");
  await expect(status).toContainText("testers");
  await expect(status).toContainText("completely free");
});

Then("the page says that segment extraction is always free", async ({ page }) => {
  await expect(page.locator('main > div[lang="en"] [data-always-free]')).toContainText("always be free");
});

Then("the page says that tigers are endangered, with the citation right after the sentence and the reference at the end", async ({ page }) => {
  const tigers = page.locator('main > div[lang="en"] [data-tigers]');
  await expect(tigers).toContainText("Endangered under the IUCN Red List (Panthera, 2025).");
  await expect(tigers).toContainText("quick extinction");
  await expect(page.locator('main > div[lang="en"] [data-references] a')).toHaveAttribute("href", /panthera\.org/);
  await expect(page.locator('main > div[lang="en"] [data-references]')).toContainText("Panthera. (2025, October 10).");
});

Then("the feature table has the columns {string}, {string}, {string}, {string} and {string}", async ({ page }, a: string, b: string, c: string, d: string, e: string) => {
  await expect(page.locator('main > div[lang="en"] [data-feature-table] thead th')).toHaveText([a, b, c, d, e]);
});

const row = (page: import("@playwright/test").Page, feature: string) =>
  page.locator('main > div[lang="en"] [data-feature-table] tbody tr').filter({ has: page.getByRole("rowheader", { name: feature }) });

Then("the paid-only features are {string}, {string} and {string}", async ({ page }, a: string, b: string, c: string) => {
  for (const feature of [a, b, c]) await expect(row(page, feature)).toHaveCount(1);
});

Then("every paid-only feature is not included for Free and included, planned, for Silver, Gold and Platinum", async ({ page }) => {
  for (const feature of ["Garmin watch integration", "The course of the World Champs in Stockholm", "Energy station planning"]) {
    await expect(row(page, feature).locator("td")).toHaveText(["Not included", "Included, planned", "Included, planned", "Included, planned"]);
  }
});

Then("segment extraction is included for every tier", async ({ page }) => {
  await expect(row(page, "Segment extraction: swims and runs, distances, map and table").locator("td")).toHaveText(["Included", "Included", "Included", "Included"]);
});

Then("the page says that nothing can be bought and that prices and tiers are a draft", async ({ page }) => {
  const note = page.locator('main > div[lang="en"] [data-prototype]');
  await expect(note).toContainText("nothing can be bought");
  await expect(note).toContainText("draft");
});

When("I switch the language to {string}", async ({ page }, code: string) => {
  await page.locator("#language-switch").selectOption(code);
});

Then("the page says that segment extraction is always free in Dutch", async ({ page }) => {
  await expect(page.locator('main > div[lang="nl"] [data-always-free]')).toBeVisible();
  await expect(page.locator('main > div[lang="nl"] [data-always-free]')).toContainText("altijd gratis");
  await expect(page.locator('main > div[lang="en"] [data-always-free]')).toBeHidden();
});
