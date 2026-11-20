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

Then("the page says that TigerLegs is under development, looking for testers and completely free, and that in beta everyone may try it if they report issues to Bart", async ({ page }) => {
  const status = page.locator('main > div[lang="en"] [data-status]');
  await expect(status).toContainText("under development");
  await expect(status).toContainText("testers");
  await expect(status).toContainText("completely free");
  await expect(status).toContainText("beta");
  await expect(status).toContainText("report issues to Bart");
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

const cells = (page: import("@playwright/test").Page, feature: string) => row(page, feature).locator("td");

Then("the feature {string} is included for every tier with a green check", async ({ page }, feature: string) => {
  await expect(cells(page, feature)).toHaveCount(4);
  for (const cell of await cells(page, feature).all()) {
    await expect(cell).toHaveAttribute("data-value", "yes");
    await expect(cell.locator("span.text-green-700")).toHaveText("✓");
  }
});

Then("the feature {string} is not included for Free with a red cross and included for Silver, Gold and Platinum", async ({ page }, feature: string) => {
  const all = cells(page, feature);
  await expect(all.nth(0)).toHaveAttribute("data-value", "no");
  await expect(all.nth(0).locator("span.text-red-700")).toHaveText("✗");
  for (const index of [1, 2, 3]) await expect(all.nth(index)).toHaveAttribute("data-value", "yes");
});

Then("the feature {string} is included for Gold and Platinum only", async ({ page }, feature: string) => {
  const all = cells(page, feature);
  for (const [index, value] of ["no", "no", "yes", "yes"].entries()) await expect(all.nth(index)).toHaveAttribute("data-value", value);
});

Then("the feature {string} has the limits {string}, {string}, {string} and {string}", async ({ page }, feature: string, a: string, b: string, c: string, d: string) => {
  await expect(cells(page, feature)).toHaveText([a, b, c, d]);
});

Then("the page pledges part of the contributions for paid features to the IUCN, with the 25,000 quote cited", async ({ page }) => {
  const pledge = page.locator('main > div[lang="en"] [data-pledge]');
  await expect(pledge).toContainText("part of the contributions for paid features");
  await expect(pledge).toContainText("IUCN");
  await expect(pledge).toContainText("over 25,000 tigers living in the wild—over five times the current global population");
  await expect(pledge).toContainText("(Panthera, 2025)");
});

Then("the tiger photo is credited to {string} under CC BY-SA 4.0 with links to the source and the licence", async ({ page }, author: string) => {
  const credit = page.locator('main > div[lang="en"] [data-photo-credit]');
  await expect(credit.getByRole("link", { name: author })).toHaveAttribute("href", /commons\.wikimedia\.org\/wiki\/File:Royal_Bengal_Tiger_at_Kanha_National_Park\.jpg/);
  await expect(credit.getByRole("link", { name: "CC BY-SA 4.0" })).toHaveAttribute("href", "https://creativecommons.org/licenses/by-sa/4.0/");
  await expect(credit).toContainText("resized");
  await expect(page.locator('main > div[lang="en"] figure img')).toHaveAttribute("alt", /Royal Bengal tiger/);
});

Then("the page explains that a back end that hosts profiles has hosting costs", async ({ page }) => {
  const hosting = page.locator('main > div[lang="en"] [data-hosting]');
  await expect(hosting).toContainText("hosts profiles");
  await expect(hosting).toContainText("servers, storage and backups");
  await expect(hosting).toContainText("stays in the free tier");
});

Then("the chat offers the question {string}", async ({ page }, question: string) => {
  await page.getByRole("button", { name: /RoARR|ROARRS/ }).first().click();
  await expect(page.getByRole("button", { name: question })).toBeVisible();
  await expect(page.getByRole("button", { name: "What is swimrun?" })).toHaveCount(0);
  await expect(page.locator("[data-chat-page-name]")).toContainText("Pricing");
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
