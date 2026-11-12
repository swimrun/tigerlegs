import { expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { parseGPX } from "../../src/client/gpx-parser.ts";
import { analyzeGpx } from "../../src/client/analyze.ts";
import { assembleRings, BBOX_GRID_DEG, coarseBbox, parseWater, pointInRing, pointInWater } from "../../src/client/water.ts";

const c = (lat: number, lon: number) => ({ lat, lon });

it("assembleRings joins way pieces into one closed ring", () => {
  const rings = assembleRings([
    [c(0, 0), c(0, 1), c(1, 1)],
    [c(1, 1), c(1, 0), c(0, 0)],
  ]);
  expect(rings.length).toEqual(1);
  expect(rings[0][0]).toEqual(rings[0][rings[0].length - 1]);
});

it("pointInRing detects inside and outside", () => {
  const ring = [c(0, 0), c(0, 2), c(2, 2), c(2, 0), c(0, 0)];
  expect(pointInRing(c(1, 1), ring)).toBeTruthy();
  expect(!pointInRing(c(3, 1), ring)).toBeTruthy();
});

it("pointInWater treats inner rings as holes", () => {
  const water = [{
    outer: [[c(0, 0), c(0, 4), c(4, 4), c(4, 0), c(0, 0)]],
    inner: [[c(1, 1), c(1, 3), c(3, 3), c(3, 1), c(1, 1)]],
  }];
  expect(pointInWater(c(0.5, 0.5), water)).toBeTruthy();
  expect(!pointInWater(c(2, 2), water)).toBeTruthy();
});

it("coarseBbox snaps outward to the grid and contains the track", () => {
  const pts = [
    { coordinate: c(52.371, 4.912) },
    { coordinate: c(52.402, 4.951) },
  ] as Parameters<typeof coarseBbox>[0];
  const [s, w, n, e] = coarseBbox(pts);
  expect(s < 52.371 && w < 4.912 && n > 52.402 && e > 4.951).toBeTruthy();
  for (const v of [s, w, n, e]) expect(Math.abs(v / BBOX_GRID_DEG - Math.round(v / BBOX_GRID_DEG)) < 1e-6).toBeTruthy();
  expect(n - s >= 2 * BBOX_GRID_DEG).toBeTruthy();
});

it("Rhederlaag with OSM water: terrain keeps the swims the speed analysis finds and adds some distance", () => {
  const parsed = parseGPX(
    readFileSync(new URL("../../test-data/rhederlaag-swimrun.gpx", import.meta.url), "utf8"),
  );
  expect(parsed.ok).toBeTruthy();
  const analysis = analyzeGpx(parsed.value);
  const water = parseWater(
    JSON.parse(readFileSync(new URL("../fixtures/rhederlaag-overpass.json", import.meta.url), "utf8")),
  );
  expect(water.length > 0).toBeTruthy();

  const withLandscape = analyzeGpx(parsed.value, water);
  expect(withLandscape.strategies.includes("landscape")).toBeTruthy();
  const refined = withLandscape.segments;
  const swims = refined.filter((s) => s.type === "swim");
  expect(swims.length >= analysis.segments.filter((s) => s.type === "swim").length).toBeTruthy();

  // The swim in the middle of the track (the 1.6 km "run" at trackpoints 4793-5596 before issue #98).
  const bigSwim = swims.find((s) => s.startTrackpointIndex <= 4800 && s.endTrackpointIndex >= 5200);
  expect(bigSwim, "expected a swim around trackpoints 4800-5200").toBeTruthy();
  expect(bigSwim.distanceKm > 0.6 && bigSwim.distanceKm < 1.2).toBeTruthy();

  for (let i = 1; i < refined.length; i++) {
    expect(refined[i].type !== refined[i - 1].type).toBeTruthy();
    expect(refined[i].startTrackpointIndex).toEqual(refined[i - 1].endTrackpointIndex + 1);
  }
  expect(Number(withLandscape.totals.totalSwimM) > Number(analysis.totals.totalSwimM)).toBeTruthy();
});

it("Rhederlaag: the speed analysis alone finds the crossings that used to hide in runs of 2 km and more", () => {
  const parsed = parseGPX(readFileSync(new URL("../../test-data/rhederlaag-swimrun.gpx", import.meta.url), "utf8"));
  expect(parsed.ok).toBeTruthy();
  const baseline = analyzeGpx(parsed.value);
  // Before issue #98 the speed analysis found runs of 2.3 and 2.7 km that contained several swims.
  const longRuns = baseline.segments.filter((segment) => segment.type === "run" && segment.distanceKm > 2.0);
  expect(longRuns.length, "no run longer than 2 km is left").toEqual(0);
  expect(baseline.segments.filter((segment) => segment.type === "swim").length >= 12).toBeTruthy();
});
