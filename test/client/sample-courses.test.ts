import { assert, assertEquals } from "@std/assert";
import { SAMPLE_COURSES, sampleFiles } from "../../src/client/sample-courses.ts";

Deno.test("every variant has a description and ids are unique within the site", () => {
  const ids = new Set<string>();
  for (const course of SAMPLE_COURSES) {
    assert(course.variants.length > 0, `${course.id} has no variants`);
    for (const variant of course.variants) {
      assert(variant.description.trim() !== "", `${course.id}/${variant.id} has no description`);
      const id = `${course.id}/${variant.id}`;
      assert(!ids.has(id), `duplicate variant ${id}`);
      ids.add(id);
    }
  }
});

Deno.test("a variant has a file and a source together, and the source exists in test-data", () => {
  for (const course of SAMPLE_COURSES) {
    for (const variant of course.variants) {
      assertEquals(variant.file === null, variant.source === null, `${course.id}/${variant.id}`);
      if (variant.source !== null) {
        assert(Deno.statSync(`test-data/${variant.source}`).isFile, `missing test-data/${variant.source}`);
      }
    }
  }
});

Deno.test("two variants never share a site file", () => {
  const files = sampleFiles().map(([, file]) => file);
  assertEquals(new Set(files).size, files.length);
});

Deno.test("every course has exactly one canonical variant, and it has a GPX file", () => {
  for (const course of SAMPLE_COURSES) {
    const canonical = course.variants.filter((variant) => variant.canonical);
    assertEquals(canonical.length, 1, `${course.id} needs exactly one canonical variant`);
    assert(canonical[0].file !== null, `${course.id}: the canonical variant needs a GPX file`);
  }
});

Deno.test("the 2025 race day recording is the canonical variant of Het Rondje Eilanden, the 2026 clean-up its first variant", () => {
  const rondje = SAMPLE_COURSES.find((course) => course.id === "rondje-eilanden")!;
  assertEquals(rondje.variants.find((variant) => variant.canonical)?.source, "Rondje_Eilanden_2025.gpx");
  assertEquals(rondje.variants.find((variant) => variant.id === "lintjes-opruimen")?.source, "Rondje_Eilanden_lintjes_opruimen.gpx");
});

Deno.test("Het Rondje Eilanden has a race day, a clean-up and a training variant, and Rhederlaag has four variants", () => {
  const rondje = SAMPLE_COURSES.find((course) => course.id === "rondje-eilanden");
  assertEquals(rondje?.variants.map((variant) => variant.id), ["race-day", "lintjes-opruimen", "training"]);
  const rhederlaag = SAMPLE_COURSES.find((course) => course.id === "rhederlaag");
  assertEquals(rhederlaag?.variants.length, 4);
  assert(rhederlaag?.variants.some((variant) => variant.id === "bird-breeding-season"));
});
