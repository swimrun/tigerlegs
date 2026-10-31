import { assert, assertEquals } from "@std/assert";
import { parseGPX } from "../../src/client/gpx-parser.ts";
import { analyzeGpx } from "../../src/client/analyze.ts";
import { assembleRings, parseWater, pointInRing, pointInWater } from "../../src/client/water.ts";

const c = (lat: number, lon: number) => ({ lat, lon });

Deno.test("assembleRings joins way pieces into one closed ring", () => {
  const rings = assembleRings([
    [c(0, 0), c(0, 1), c(1, 1)],
    [c(1, 1), c(1, 0), c(0, 0)],
  ]);
  assertEquals(rings.length, 1);
  assertEquals(rings[0][0], rings[0][rings[0].length - 1]);
});

Deno.test("pointInRing detects inside and outside", () => {
  const ring = [c(0, 0), c(0, 2), c(2, 2), c(2, 0), c(0, 0)];
  assert(pointInRing(c(1, 1), ring));
  assert(!pointInRing(c(3, 1), ring));
});

Deno.test("pointInWater treats inner rings as holes", () => {
  const water = [{
    outer: [[c(0, 0), c(0, 4), c(4, 4), c(4, 0), c(0, 0)]],
    inner: [[c(1, 1), c(1, 3), c(3, 3), c(3, 1), c(1, 1)]],
  }];
  assert(pointInWater(c(0.5, 0.5), water));
  assert(!pointInWater(c(2, 2), water));
});

Deno.test("Rhederlaag with OSM water: terrain splits the speed-only runs", () => {
  const parsed = parseGPX(
    Deno.readTextFileSync(new URL("../../test-data/rhederlaag-swimrun.gpx", import.meta.url)),
  );
  assert(parsed.ok);
  const analysis = analyzeGpx(parsed.value);
  const water = parseWater(
    JSON.parse(Deno.readTextFileSync(new URL("../fixtures/rhederlaag-overpass.json", import.meta.url))),
  );
  assert(water.length > 0);

  const withLandscape = analyzeGpx(parsed.value, water);
  assert(withLandscape.strategies.includes("landscape"));
  const refined = withLandscape.segments;
  const swims = refined.filter((s) => s.type === "swim");
  assert(swims.length > analysis.segments.filter((s) => s.type === "swim").length);

  // The 1.6 km "run" at trackpoints 4793-5596 contains a swim of roughly 800 m.
  const bigSwim = swims.find((s) => s.startTrackpointIndex <= 4800 && s.endTrackpointIndex >= 5200);
  assert(bigSwim, "expected a swim around trackpoints 4800-5200");
  assert(bigSwim.distanceKm > 0.6 && bigSwim.distanceKm < 1.0);

  for (let i = 1; i < refined.length; i++) {
    assert(refined[i].type !== refined[i - 1].type);
    assertEquals(refined[i].startTrackpointIndex, refined[i - 1].endTrackpointIndex + 1);
  }
  assert(Number(withLandscape.totals.totalSwimM) > Number(analysis.totals.totalSwimM));
});
