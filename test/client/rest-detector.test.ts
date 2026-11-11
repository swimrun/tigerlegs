import { expect, it } from "vitest";
import type { Segment, Trackpoint } from "../../src/shared/types.ts";
import { detectRestSpans, splitAtRests } from "../../src/client/rest-detector.ts";
import { cleanSegments } from "../../src/client/segment-cleaner.ts";
import { analyzeGpx } from "../../src/client/analyze.ts";

function point(index: number, metres: number): Trackpoint {
  return {
    coordinate: { lat: 0, lon: metres / 111195 },
    timestamp: new Date(Date.UTC(2024, 0, 1) + index * 1000).toISOString(),
    elevation: 0,
    index,
  };
}

it("rests: GPS jitter cannot turn a sustained rest into moving swim distance", () => {
  const points = Array.from({ length: 1501 }, (_, i) => point(i, i % 2 ? 1 : -1));
  expect(detectRestSpans(points)).toEqual([{ start: 0, end: 1500, seconds: 1500 }]);
});

it("rests: a genuine slow moving swim and a short pause remain untouched", () => {
  expect(detectRestSpans(Array.from({ length: 1501 }, (_, i) => point(i, i * 0.3)))).toEqual([]);
  expect(detectRestSpans(Array.from({ length: 121 }, (_, i) => point(i, 0)))).toEqual([]);
});

it("rests: missing or reversed timestamps do not establish a rest", () => {
  const points = Array.from({ length: 1501 }, (_, i) => ({ ...point(i, 0), timestamp: null }));
  expect(detectRestSpans(points)).toEqual([]);
  expect(detectRestSpans(Array.from({ length: 1501 }, (_, i) => point(1500 - i, 0)))).toEqual([]);
});

it("rests: cleanup preserves rests between same-type laps", () => {
  const points = Array.from({ length: 1801 }, (_, i) => point(i, i < 100 ? i * 3 : i < 1700 ? 300 : 300 + (i - 1700) * 3));
  const segment: Segment = {
    number: 1, type: "run", startTrackpointIndex: 0, endTrackpointIndex: 1800,
    distanceKm: 1, confidenceScore: 0.9, detectedBy: ["speed"], gpsFiltered: false,
  };
  const result = cleanSegments(splitAtRests([segment], detectRestSpans(points), points));
  expect(result.map(segment => segment.type)).toEqual(["run", "unclassified", "run"]);
});

it("backyard: three synthetic mixed laps retain swims, runs and inter-lap rests", () => {
  const points: Trackpoint[] = [];
  let metres = 0;
  const move = (seconds: number, metresPerSecond: number) => {
    for (let i = 0; i < seconds; i++) {
      metres += metresPerSecond;
      points.push(point(points.length, metres));
    }
  };
  for (let lap = 0; lap < 3; lap++) {
    move(180, 3);
    move(180, 0.6);
    move(180, 3);
    if (lap < 2) move(1500, 0);
  }
  const analysis = analyzeGpx({ waypoints: [], tracks: [{ name: "Synthetic backyard", trackpoints: points }] });
  expect(analysis.segments.map(segment => segment.type)).toEqual([
    "run", "swim", "run", "unclassified",
    "run", "swim", "run", "unclassified",
    "run", "swim", "run",
  ]);
});
