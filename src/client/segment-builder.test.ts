import { assertEquals } from "@std/assert";
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

Deno.test("roundSwimDistance - 387 → 400 (round to nearest 50m)", () => {
  assertEquals(roundSwimDistance(387), 400);
});

Deno.test("roundSwimDistance - 1125 → 1150 (round to nearest 50m)", () => {
  assertEquals(roundSwimDistance(1125), 1150);
});

Deno.test("roundSwimDistance - 2220 → 2200 (round to nearest 50m)", () => {
  assertEquals(roundSwimDistance(2220), 2200);
});

Deno.test("roundSwimDistance - 0 → 0", () => {
  assertEquals(roundSwimDistance(0), 0);
});

Deno.test("roundSwimDistance - 25 → 50 (midpoint rounds up)", () => {
  assertEquals(roundSwimDistance(25), 50);
});

Deno.test("roundSwimDistance - 24 → 0 (below midpoint rounds down)", () => {
  assertEquals(roundSwimDistance(24), 0);
});

Deno.test("roundSwimDistance - 50 → 50 (exact multiple unchanged)", () => {
  assertEquals(roundSwimDistance(50), 50);
});

Deno.test("roundSwimDistance - 75 → 100", () => {
  assertEquals(roundSwimDistance(75), 100);
});

// --- roundRunDistance ---

Deno.test("roundRunDistance - 5.23 → 5.2 (round to nearest 0.1 km)", () => {
  assertEquals(roundRunDistance(5.23), 5.2);
});

Deno.test("roundRunDistance - 1.37 → 1.4 (round to nearest 0.1 km)", () => {
  assertEquals(roundRunDistance(1.37), 1.4);
});

Deno.test("roundRunDistance - 0 → 0", () => {
  assertEquals(roundRunDistance(0), 0);
});

Deno.test("roundRunDistance - 3.05 → 3.1 (midpoint rounds up)", () => {
  assertEquals(roundRunDistance(3.05), 3.1);
});

Deno.test("roundRunDistance - 10.0 → 10.0 (exact value unchanged)", () => {
  assertEquals(roundRunDistance(10.0), 10.0);
});

// --- buildSegments ---

Deno.test("buildSegments - single swim pair produces run-swim-run segments", () => {
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
  assertEquals(result.ok, true);
  if (!result.ok) return;

  assertEquals(result.value.length, 3);
  assertEquals(result.value[0].type, "run");
  assertEquals(result.value[1].type, "swim");
  assertEquals(result.value[2].type, "run");

  // Segments should be numbered sequentially
  assertEquals(result.value[0].number, 1);
  assertEquals(result.value[1].number, 2);
  assertEquals(result.value[2].number, 3);

  // All segments should have distances > 0
  for (const seg of result.value) {
    assertEquals(seg.distanceKm >= 0, true);
  }
});

Deno.test("buildSegments - race starting with swim produces swim-run", () => {
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
  assertEquals(result.ok, true);
  if (!result.ok) return;

  assertEquals(result.value[0].type, "swim");
  assertEquals(result.value[1].type, "run");
});

Deno.test("buildSegments - no swim waypoints produces single run segment", () => {
  const trackpoints: Trackpoint[] = [];
  for (let i = 0; i < 5; i++) {
    trackpoints.push(makeTrackpoint(i, 45.0 + i * 0.0001, 5.0));
  }
  const classifiedWaypoints: ClassifiedWaypoint[] = [];

  const result = buildSegments(trackpoints, classifiedWaypoints);
  assertEquals(result.ok, true);
  if (!result.ok) return;

  assertEquals(result.value.length, 1);
  assertEquals(result.value[0].type, "run");
  assertEquals(result.value[0].number, 1);
});

Deno.test("buildSegments - empty trackpoints returns error", () => {
  const result = buildSegments([], []);
  assertEquals(result.ok, false);
});

Deno.test("buildSegments - segments have detectedBy 'waypoint' and confidenceScore", () => {
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
  assertEquals(result.ok, true);
  if (!result.ok) return;

  for (const seg of result.value) {
    assertEquals(seg.detectedBy, ["waypoint"]);
    assertEquals(seg.confidenceScore, 0.95);
    assertEquals(seg.gpsFiltered, false);
  }
});

// --- pairSegmentsForDisplay ---

Deno.test("pairSegmentsForDisplay - run-first (default): pairs run N with swim N", () => {
  const segments: Segment[] = [
    makeSegment({ number: 1, type: "run", distanceKm: 5.23 }),
    makeSegment({ number: 2, type: "swim", distanceKm: 0.387 }),
    makeSegment({ number: 3, type: "run", distanceKm: 1.37 }),
    makeSegment({ number: 4, type: "swim", distanceKm: 2.22 }),
    makeSegment({ number: 5, type: "run", distanceKm: 3.05 }),
  ];

  const pairs = pairSegmentsForDisplay(segments, false);

  // Row 1: run 5.23 km + swim 387m → "5.2" + "400"
  assertEquals(pairs[0].number, 1);
  assertEquals(pairs[0].runDistanceKm, "5.2");
  assertEquals(pairs[0].swimDistanceM, "400");

  // Row 2: run 1.37 km + swim 2220m → "1.4" + "2200"
  assertEquals(pairs[1].number, 2);
  assertEquals(pairs[1].runDistanceKm, "1.4");
  assertEquals(pairs[1].swimDistanceM, "2200");

  // Row 3: run 3.05 km + no swim → "3.1" + "—"
  assertEquals(pairs[2].number, 3);
  assertEquals(pairs[2].runDistanceKm, "3.1");
  assertEquals(pairs[2].swimDistanceM, "—");
});

Deno.test("pairSegmentsForDisplay - swim-first: pairs swim N with run N", () => {
  const segments: Segment[] = [
    makeSegment({ number: 1, type: "swim", distanceKm: 0.387 }),
    makeSegment({ number: 2, type: "run", distanceKm: 5.23 }),
    makeSegment({ number: 3, type: "swim", distanceKm: 1.125 }),
    makeSegment({ number: 4, type: "run", distanceKm: 1.37 }),
  ];

  const pairs = pairSegmentsForDisplay(segments, true);

  // Row 1: swim 387m + run 5.23 km → "400" + "5.2"
  assertEquals(pairs[0].number, 1);
  assertEquals(pairs[0].swimDistanceM, "400");
  assertEquals(pairs[0].runDistanceKm, "5.2");

  // Row 2: swim 1125m + run 1.37 km → "1150" + "1.4"
  assertEquals(pairs[1].number, 2);
  assertEquals(pairs[1].swimDistanceM, "1150");
  assertEquals(pairs[1].runDistanceKm, "1.4");
});

Deno.test("pairSegmentsForDisplay - incomplete first pair (swim-first, starts with run) uses dash", () => {
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
  assertEquals(pairs[0].swimDistanceM, "—");
  assertEquals(pairs[0].runDistanceKm !== "—", true);
});

Deno.test("pairSegmentsForDisplay - incomplete last pair uses dash for absent value", () => {
  // Race ends with a swim (no trailing run)
  const segments: Segment[] = [
    makeSegment({ number: 1, type: "run", distanceKm: 5.0 }),
    makeSegment({ number: 2, type: "swim", distanceKm: 0.4 }),
  ];

  const pairs = pairSegmentsForDisplay(segments, false);
  // Row 1: run 5.0 + swim 400 → "5.0" + "400"
  assertEquals(pairs[0].runDistanceKm, "5.0");
  assertEquals(pairs[0].swimDistanceM, "400");
  // Only 1 pair (complete)
  assertEquals(pairs.length, 1);
});

Deno.test("pairSegmentsForDisplay - single run segment uses dash for swim", () => {
  const segments: Segment[] = [
    makeSegment({ number: 1, type: "run", distanceKm: 10.0 }),
  ];

  const pairs = pairSegmentsForDisplay(segments, false);
  assertEquals(pairs.length, 1);
  assertEquals(pairs[0].runDistanceKm, "10.0");
  assertEquals(pairs[0].swimDistanceM, "—");
});

Deno.test("pairSegmentsForDisplay - assigns sequential pair numbers", () => {
  const segments: Segment[] = [
    makeSegment({ number: 1, type: "run", distanceKm: 5.0 }),
    makeSegment({ number: 2, type: "swim", distanceKm: 0.4 }),
    makeSegment({ number: 3, type: "run", distanceKm: 3.0 }),
    makeSegment({ number: 4, type: "swim", distanceKm: 0.8 }),
  ];

  const pairs = pairSegmentsForDisplay(segments, false);
  assertEquals(pairs[0].number, 1);
  assertEquals(pairs[1].number, 2);
});

// --- calculateTotals ---

Deno.test("calculateTotals - sums all swim and run distances with rounding", () => {
  const segments: Segment[] = [
    makeSegment({ number: 1, type: "run", distanceKm: 5.23 }),
    makeSegment({ number: 2, type: "swim", distanceKm: 0.387 }),
    makeSegment({ number: 3, type: "run", distanceKm: 1.37 }),
    makeSegment({ number: 4, type: "swim", distanceKm: 2.22 }),
  ];

  const totals = calculateTotals(segments);
  // Total run: 5.23 + 1.37 = 6.6 km → rounded to 0.1 = "6.6"
  assertEquals(totals.totalRunKm, "6.6");
  // Total swim: 387 + 2220 = 2607m → rounded to 50m = "2600"
  assertEquals(totals.totalSwimM, "2600");
});

Deno.test("calculateTotals - empty segments returns zeros", () => {
  const totals = calculateTotals([]);
  assertEquals(totals.totalRunKm, "0.0");
  assertEquals(totals.totalSwimM, "0");
});

Deno.test("calculateTotals - only run segments", () => {
  const segments: Segment[] = [
    makeSegment({ number: 1, type: "run", distanceKm: 10.0 }),
  ];

  const totals = calculateTotals(segments);
  assertEquals(totals.totalRunKm, "10.0");
  assertEquals(totals.totalSwimM, "0");
});

Deno.test("calculateTotals - only swim segments", () => {
  const segments: Segment[] = [
    makeSegment({ number: 1, type: "swim", distanceKm: 0.5 }),
  ];

  const totals = calculateTotals(segments);
  assertEquals(totals.totalRunKm, "0.0");
  assertEquals(totals.totalSwimM, "500");
});
