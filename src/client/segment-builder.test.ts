import { expect, it } from "vitest";
import type {
  ClassifiedWaypoint,
  Segment,
  Trackpoint,
  Waypoint,
} from "../shared/types.ts";
import {
  buildSegments,
  calculateTotals,
  pairSegmentsForDisplay,
  roundRunDistance,
  roundSwimDistance,
} from "./segment-builder.ts";

// --- Helpers ---

function makeWaypoint(overrides: Partial<Waypoint> = {}): Waypoint {
  return {
    coordinate: { lat: 45.0, lon: 5.0 },
    elevation: 100,
    name: "",
    symbol: "",
    description: "",
    ...overrides,
  };
}

function makeTrackpoint(index: number, lat: number, lon: number): Trackpoint {
  return {
    coordinate: { lat, lon },
    elevation: 100,
    timestamp: null,
    index,
  };
}

function makeSegment(overrides: Partial<Segment> = {}): Segment {
  return {
    number: 1,
    type: "run",
    startTrackpointIndex: 0,
    endTrackpointIndex: 10,
    distanceKm: 5.0,
    detectedBy: ["waypoint"],
    confidenceScore: 0.95,
    gpsFiltered: false,
    ...overrides,
  };
}

// --- roundSwimDistance ---

it("roundSwimDistance - 387 → 400 (round to nearest 50m)", () => {
  expect(roundSwimDistance(387)).toEqual(400);
});

it("roundSwimDistance - 1125 → 1150 (round to nearest 50m)", () => {
  expect(roundSwimDistance(1125)).toEqual(1150);
});

it("roundSwimDistance - 2220 → 2200 (round to nearest 50m)", () => {
  expect(roundSwimDistance(2220)).toEqual(2200);
});

it("roundSwimDistance - 0 → 0", () => {
  expect(roundSwimDistance(0)).toEqual(0);
});

it("roundSwimDistance - 25 → 50 (midpoint rounds up)", () => {
  expect(roundSwimDistance(25)).toEqual(50);
});

it("roundSwimDistance - 24 → 0 (below midpoint rounds down)", () => {
  expect(roundSwimDistance(24)).toEqual(0);
});

it("roundSwimDistance - 50 → 50 (exact multiple unchanged)", () => {
  expect(roundSwimDistance(50)).toEqual(50);
});

it("roundSwimDistance - 75 → 100", () => {
  expect(roundSwimDistance(75)).toEqual(100);
});

// --- roundRunDistance ---

it("roundRunDistance - 5.23 → 5.2 (round to nearest 0.1 km)", () => {
  expect(roundRunDistance(5.23)).toEqual(5.2);
});

it("roundRunDistance - 1.37 → 1.4 (round to nearest 0.1 km)", () => {
  expect(roundRunDistance(1.37)).toEqual(1.4);
});

it("roundRunDistance - 0 → 0", () => {
  expect(roundRunDistance(0)).toEqual(0);
});

it("roundRunDistance - 3.05 → 3.1 (midpoint rounds up)", () => {
  expect(roundRunDistance(3.05)).toEqual(3.1);
});

it("roundRunDistance - 10.0 → 10.0 (exact value unchanged)", () => {
  expect(roundRunDistance(10.0)).toEqual(10.0);
});

// --- buildSegments ---

it("buildSegments - single swim pair produces run-swim-run segments", () => {
  const trackpoints: Trackpoint[] = [];
  for (let i = 0; i < 10; i++) {
    trackpoints.push(makeTrackpoint(i, 45.0 + i * 0.0001, 5.0));
  }
  const classifiedWaypoints: ClassifiedWaypoint[] = [
    {
      waypoint: makeWaypoint({
        symbol: "200",
        coordinate: { lat: 45.0003, lon: 5.0 },
      }),
      type: "swim-start",
    },
    {
      waypoint: makeWaypoint({
        symbol: "201",
        coordinate: { lat: 45.0006, lon: 5.0 },
      }),
      type: "swim-end",
    },
  ];

  const result = buildSegments(trackpoints, classifiedWaypoints);
  expect(result.ok).toEqual(true);
  if (!result.ok) return;

  expect(result.value.length).toEqual(3);
  expect(result.value[0].type).toEqual("run");
  expect(result.value[1].type).toEqual("swim");
  expect(result.value[2].type).toEqual("run");

  // Segments should be numbered sequentially
  expect(result.value[0].number).toEqual(1);
  expect(result.value[1].number).toEqual(2);
  expect(result.value[2].number).toEqual(3);

  // All segments should have distances > 0
  for (const seg of result.value) {
    expect(seg.distanceKm >= 0).toEqual(true);
  }
});

it("buildSegments - race starting with swim produces swim-run", () => {
  const trackpoints: Trackpoint[] = [];
  for (let i = 0; i < 10; i++) {
    trackpoints.push(makeTrackpoint(i, 45.0 + i * 0.0001, 5.0));
  }
  const classifiedWaypoints: ClassifiedWaypoint[] = [
    {
      waypoint: makeWaypoint({
        symbol: "200",
        coordinate: { lat: 45.0, lon: 5.0 },
      }),
      type: "swim-start",
    },
    {
      waypoint: makeWaypoint({
        symbol: "201",
        coordinate: { lat: 45.0004, lon: 5.0 },
      }),
      type: "swim-end",
    },
  ];

  const result = buildSegments(trackpoints, classifiedWaypoints);
  expect(result.ok).toEqual(true);
  if (!result.ok) return;

  expect(result.value[0].type).toEqual("swim");
  expect(result.value[1].type).toEqual("run");
});

it("buildSegments - no swim waypoints produces single run segment", () => {
  const trackpoints: Trackpoint[] = [];
  for (let i = 0; i < 5; i++) {
    trackpoints.push(makeTrackpoint(i, 45.0 + i * 0.0001, 5.0));
  }
  const classifiedWaypoints: ClassifiedWaypoint[] = [];

  const result = buildSegments(trackpoints, classifiedWaypoints);
  expect(result.ok).toEqual(true);
  if (!result.ok) return;

  expect(result.value.length).toEqual(1);
  expect(result.value[0].type).toEqual("run");
  expect(result.value[0].number).toEqual(1);
});

it("buildSegments - empty trackpoints returns error", () => {
  const result = buildSegments([], []);
  expect(result.ok).toEqual(false);
});

it("buildSegments - segments have detectedBy 'waypoint' and confidenceScore", () => {
  const trackpoints: Trackpoint[] = [];
  for (let i = 0; i < 10; i++) {
    trackpoints.push(makeTrackpoint(i, 45.0 + i * 0.0001, 5.0));
  }
  const classifiedWaypoints: ClassifiedWaypoint[] = [
    {
      waypoint: makeWaypoint({
        symbol: "200",
        coordinate: { lat: 45.0003, lon: 5.0 },
      }),
      type: "swim-start",
    },
    {
      waypoint: makeWaypoint({
        symbol: "201",
        coordinate: { lat: 45.0006, lon: 5.0 },
      }),
      type: "swim-end",
    },
  ];

  const result = buildSegments(trackpoints, classifiedWaypoints);
  expect(result.ok).toEqual(true);
  if (!result.ok) return;

  for (const seg of result.value) {
    expect(seg.detectedBy).toEqual(["waypoint"]);
    expect(seg.confidenceScore).toEqual(0.95);
    expect(seg.gpsFiltered).toEqual(false);
  }
});

// --- pairSegmentsForDisplay ---

it("pairSegmentsForDisplay - run-first (default): pairs run N with swim N", () => {
  const segments: Segment[] = [
    makeSegment({ number: 1, type: "run", distanceKm: 5.23 }),
    makeSegment({ number: 2, type: "swim", distanceKm: 0.387 }),
    makeSegment({ number: 3, type: "run", distanceKm: 1.37 }),
    makeSegment({ number: 4, type: "swim", distanceKm: 2.22 }),
    makeSegment({ number: 5, type: "run", distanceKm: 3.05 }),
  ];

  const pairs = pairSegmentsForDisplay(segments, false);

  // Row 1: run 5.23 km + swim 387m → "5.2" + "400"
  expect(pairs[0].number).toEqual(1);
  expect(pairs[0].runDistanceKm).toEqual("5.2");
  expect(pairs[0].swimDistanceM).toEqual("400");

  // Row 2: run 1.37 km + swim 2220m → "1.4" + "2200"
  expect(pairs[1].number).toEqual(2);
  expect(pairs[1].runDistanceKm).toEqual("1.4");
  expect(pairs[1].swimDistanceM).toEqual("2200");

  // Row 3: run 3.05 km + no swim → "3.1" + "—"
  expect(pairs[2].number).toEqual(3);
  expect(pairs[2].runDistanceKm).toEqual("3.1");
  expect(pairs[2].swimDistanceM).toEqual("—");
});

it("pairSegmentsForDisplay - swim-first: pairs swim N with run N", () => {
  const segments: Segment[] = [
    makeSegment({ number: 1, type: "swim", distanceKm: 0.387 }),
    makeSegment({ number: 2, type: "run", distanceKm: 5.23 }),
    makeSegment({ number: 3, type: "swim", distanceKm: 1.125 }),
    makeSegment({ number: 4, type: "run", distanceKm: 1.37 }),
  ];

  const pairs = pairSegmentsForDisplay(segments, true);

  // Row 1: swim 387m + run 5.23 km → "400" + "5.2"
  expect(pairs[0].number).toEqual(1);
  expect(pairs[0].swimDistanceM).toEqual("400");
  expect(pairs[0].runDistanceKm).toEqual("5.2");

  // Row 2: swim 1125m + run 1.37 km → "1150" + "1.4"
  expect(pairs[1].number).toEqual(2);
  expect(pairs[1].swimDistanceM).toEqual("1150");
  expect(pairs[1].runDistanceKm).toEqual("1.4");
});

it("pairSegmentsForDisplay - incomplete first pair (swim-first, starts with run) uses dash", () => {
  // A race starting with a run in "swim first" mode — first row has no swim
  const segments: Segment[] = [
    makeSegment({ number: 1, type: "run", distanceKm: 2.5 }),
    makeSegment({ number: 2, type: "swim", distanceKm: 0.4 }),
    makeSegment({ number: 3, type: "run", distanceKm: 3.0 }),
  ];

  // In swim-first mode with a run-first race, the first pair is incomplete
  const pairs = pairSegmentsForDisplay(segments, true);
  // This should handle the mismatch by showing dash for the missing lead segment
  // When swimFirst=true but race starts with run: first pair has "—" for swim
  expect(pairs[0].swimDistanceM).toEqual("—");
  expect(pairs[0].runDistanceKm !== "—").toEqual(true);
});

it("pairSegmentsForDisplay - incomplete last pair uses dash for absent value", () => {
  // Race ends with a swim (no trailing run)
  const segments: Segment[] = [
    makeSegment({ number: 1, type: "run", distanceKm: 5.0 }),
    makeSegment({ number: 2, type: "swim", distanceKm: 0.4 }),
  ];

  const pairs = pairSegmentsForDisplay(segments, false);
  // Row 1: run 5.0 + swim 400 → "5.0" + "400"
  expect(pairs[0].runDistanceKm).toEqual("5.0");
  expect(pairs[0].swimDistanceM).toEqual("400");
  // Only 1 pair (complete)
  expect(pairs.length).toEqual(1);
});

it("pairSegmentsForDisplay - single run segment uses dash for swim", () => {
  const segments: Segment[] = [
    makeSegment({ number: 1, type: "run", distanceKm: 10.0 }),
  ];

  const pairs = pairSegmentsForDisplay(segments, false);
  expect(pairs.length).toEqual(1);
  expect(pairs[0].runDistanceKm).toEqual("10.0");
  expect(pairs[0].swimDistanceM).toEqual("—");
});

it("pairSegmentsForDisplay - assigns sequential pair numbers", () => {
  const segments: Segment[] = [
    makeSegment({ number: 1, type: "run", distanceKm: 5.0 }),
    makeSegment({ number: 2, type: "swim", distanceKm: 0.4 }),
    makeSegment({ number: 3, type: "run", distanceKm: 3.0 }),
    makeSegment({ number: 4, type: "swim", distanceKm: 0.8 }),
  ];

  const pairs = pairSegmentsForDisplay(segments, false);
  expect(pairs[0].number).toEqual(1);
  expect(pairs[1].number).toEqual(2);
});

// --- calculateTotals ---

it("calculateTotals - sums all swim and run distances with rounding", () => {
  const segments: Segment[] = [
    makeSegment({ number: 1, type: "run", distanceKm: 5.23 }),
    makeSegment({ number: 2, type: "swim", distanceKm: 0.387 }),
    makeSegment({ number: 3, type: "run", distanceKm: 1.37 }),
    makeSegment({ number: 4, type: "swim", distanceKm: 2.22 }),
  ];

  const totals = calculateTotals(segments);
  // Total run: 5.23 + 1.37 = 6.6 km → rounded to 0.1 = "6.6"
  expect(totals.totalRunKm).toEqual("6.6");
  // Total swim: 387 + 2220 = 2607m → rounded to 50m = "2600"
  expect(totals.totalSwimM).toEqual("2600");
});

it("calculateTotals - empty segments returns zeros", () => {
  const totals = calculateTotals([]);
  expect(totals.totalRunKm).toEqual("0.0");
  expect(totals.totalSwimM).toEqual("0");
});

it("calculateTotals - only run segments", () => {
  const segments: Segment[] = [
    makeSegment({ number: 1, type: "run", distanceKm: 10.0 }),
  ];

  const totals = calculateTotals(segments);
  expect(totals.totalRunKm).toEqual("10.0");
  expect(totals.totalSwimM).toEqual("0");
});

it("calculateTotals - only swim segments", () => {
  const segments: Segment[] = [
    makeSegment({ number: 1, type: "swim", distanceKm: 0.5 }),
  ];

  const totals = calculateTotals(segments);
  expect(totals.totalRunKm).toEqual("0.0");
  expect(totals.totalSwimM).toEqual("500");
});
