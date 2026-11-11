import { assert, assertEquals } from "@std/assert";

/** The colours of the extractor and the training week come from one place: the CSS variables of styles.css. */
const css = Deno.readTextFileSync("src/client/styles.css");

const variable = (name: string) => css.match(new RegExp(`--${name}:\\s*(#[0-9a-fA-F]{6})\\s*;`))?.[1];

Deno.test("styles.css defines the shared colours as hex values", () => {
  for (const name of ["color-swim", "color-run", "color-unclassified", "color-swimrun", "color-strength", "color-mobility"]) {
    assert(variable(name), `--${name} is missing in styles.css`);
  }
});

Deno.test("the extractor's colours keep their values", () => {
  assertEquals(variable("color-swim")?.toLowerCase(), "#1e88e5");
  assertEquals(variable("color-run")?.toLowerCase(), "#2e7d32");
  assertEquals(variable("color-unclassified")?.toLowerCase(), "#757575");
});

Deno.test("a trail run is the extractor's run colour and a road run its unclassified grey", () => {
  assert(/\.tone-trail\s*\{\s*--tone:\s*var\(--color-run\);\s*\}/.test(css));
  assert(/\.tone-road\s*\{\s*--tone:\s*var\(--color-unclassified\);\s*\}/.test(css));
  assert(/\.tone-swim\s*\{\s*--tone:\s*var\(--color-swim\);\s*\}/.test(css));
});

Deno.test("the extractor map reads the variables and does not repeat the colours", () => {
  const map = Deno.readTextFileSync("src/components/CourseMap.tsx");
  for (const name of ["--color-swim", "--color-run", "--color-unclassified"]) assert(map.includes(name), `${name} is not read`);
  for (const hex of ["#1e88e5", "#2e7d32", "#757575"]) assert(!map.toLowerCase().includes(hex), `${hex} is hard-coded in CourseMap`);
});

Deno.test("the training week colours its sessions with the shared tones, not with its own colours", () => {
  const week = Deno.readTextFileSync("src/components/TrainingWeek.tsx");
  for (const tone of ["tone-trail", "tone-road", "tone-swim", "tone-swimrun", "tone-strength", "tone-mobility"]) {
    assert(week.includes(tone), `${tone} is not used`);
  }
  assert(!/bg-(green|emerald|sky|rose|violet|indigo)-\d+/.test(week), "a session colour is hard-coded in TrainingWeek");
});
