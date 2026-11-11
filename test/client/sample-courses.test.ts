import { expect, it } from "vitest";
import { statSync } from "node:fs";
import { SAMPLE_COURSES, sampleFiles } from "../../src/client/sample-courses.ts";

it("every variant has a description and ids are unique within the site", () => {
  const ids = new Set<string>();
  for (const course of SAMPLE_COURSES) {
    expect(course.variants.length > 0, `${course.id} has no variants`).toBeTruthy();
    for (const variant of course.variants) {
      expect(variant.description.trim() !== "", `${course.id}/${variant.id} has no description`).toBeTruthy();
      const id = `${course.id}/${variant.id}`;
      expect(!ids.has(id), `duplicate variant ${id}`).toBeTruthy();
      ids.add(id);
    }
  }
});

it("a variant has a file and a source together, and the source exists in test-data", () => {
  for (const course of SAMPLE_COURSES) {
    for (const variant of course.variants) {
      expect(variant.file === null, `${course.id}/${variant.id}`).toEqual(variant.source === null);
      if (variant.source !== null) {
        expect(statSync(`test-data/${variant.source}`).isFile(), `missing test-data/${variant.source}`).toBeTruthy();
      }
    }
  }
});

it("two variants never share a site file", () => {
  const files = sampleFiles().map(([, file]) => file);
  expect(new Set(files).size).toEqual(files.length);
});

it("every course has exactly one canonical variant, and it has a GPX file", () => {
  for (const course of SAMPLE_COURSES) {
    const canonical = course.variants.filter((variant) => variant.canonical);
    expect(canonical.length, `${course.id} needs exactly one canonical variant`).toEqual(1);
    expect(canonical[0].file !== null, `${course.id}: the canonical variant needs a GPX file`).toBeTruthy();
  }
});

it("the 2025 race day recording is the canonical variant of Het Rondje Eilanden, the 2026 clean-up its first variant", () => {
  const rondje = SAMPLE_COURSES.find((course) => course.id === "rondje-eilanden")!;
  expect(rondje.variants.find((variant) => variant.canonical)?.source).toEqual("Rondje_Eilanden_2025.gpx");
  expect(rondje.variants.find((variant) => variant.id === "lintjes-opruimen")?.source).toEqual("Rondje_Eilanden_lintjes_opruimen.gpx");
});

it("Het Rondje Eilanden has a race day, a clean-up and a training variant, and Rhederlaag has four variants", () => {
  const rondje = SAMPLE_COURSES.find((course) => course.id === "rondje-eilanden");
  expect(rondje?.variants.map((variant) => variant.id)).toEqual(["race-day", "lintjes-opruimen", "training"]);
  const rhederlaag = SAMPLE_COURSES.find((course) => course.id === "rhederlaag");
  expect(rhederlaag?.variants.length).toEqual(4);
  expect(rhederlaag?.variants.some((variant) => variant.id === "bird-breeding-season")).toBeTruthy();
});
