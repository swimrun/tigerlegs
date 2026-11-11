import { expect, it } from "vitest";
import { readFileSync } from "node:fs";

/** The colours of the extractor and the training week come from one place: the CSS variables of styles.css. */
const css = readFileSync("src/client/styles.css", "utf8");

const variable = (name: string) => css.match(new RegExp(`--${name}:\\s*(#[0-9a-fA-F]{6})\\s*;`))?.[1];

it("styles.css defines the shared colours as hex values", () => {
  for (const name of ["color-swim", "color-run", "color-unclassified", "color-swimrun", "color-strength", "color-mobility"]) {
    expect(variable(name), `--${name} is missing in styles.css`).toBeTruthy();
  }
});

it("the extractor's colours keep their values", () => {
  expect(variable("color-swim")?.toLowerCase()).toEqual("#1e88e5");
  expect(variable("color-run")?.toLowerCase()).toEqual("#2e7d32");
  expect(variable("color-unclassified")?.toLowerCase()).toEqual("#757575");
});

it("a trail run is the extractor's run colour and a road run its unclassified grey", () => {
  expect(/\.tone-trail\s*\{\s*--tone:\s*var\(--color-run\);\s*\}/.test(css)).toBeTruthy();
  expect(/\.tone-road\s*\{\s*--tone:\s*var\(--color-unclassified\);\s*\}/.test(css)).toBeTruthy();
  expect(/\.tone-swim\s*\{\s*--tone:\s*var\(--color-swim\);\s*\}/.test(css)).toBeTruthy();
});

it("the extractor map reads the variables and does not repeat the colours", () => {
  const map = readFileSync("src/components/CourseMap.tsx", "utf8");
  for (const name of ["--color-swim", "--color-run", "--color-unclassified"]) expect(map.includes(name), `${name} is not read`).toBeTruthy();
  for (const hex of ["#1e88e5", "#2e7d32", "#757575"]) expect(!map.toLowerCase().includes(hex), `${hex} is hard-coded in CourseMap`).toBeTruthy();
});

it("the training week colours its sessions with the shared tones, not with its own colours", () => {
  const week = readFileSync("src/components/TrainingWeek.tsx", "utf8");
  for (const tone of ["tone-trail", "tone-road", "tone-swim", "tone-swimrun", "tone-strength", "tone-mobility"]) {
    expect(week.includes(tone), `${tone} is not used`).toBeTruthy();
  }
  expect(!/bg-(green|emerald|sky|rose|violet|indigo)-\d+/.test(week), "a session colour is hard-coded in TrainingWeek").toBeTruthy();
});
