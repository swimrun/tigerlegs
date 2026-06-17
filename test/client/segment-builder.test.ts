import { assert, assertEquals } from "@std/assert";
import fc from "fast-check";
import type {
  ClassifiedWaypoint,
  Segment,
  Trackpoint,
  Waypoint,
} from "../../src/shared/types.ts";
import {
  buildSegments,
  calculateTotals,
  pairSegmentsForDisplay,
  roundRunDistance,
  roundSwimDistance,
} from "../../src/client/segment-builder.ts";

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
    endTrackpointIndex: 9,
    distanceKm: 5.23,
    detectedBy: ["waypoint"],
    confidenceScore: 0.95,
    gpsFiltered: false,
    ...overrides,
  };
}

// --- roundSwimDistance ---

Deno.test("roundSwimDistance - 387 → 400 (rounds to nearest 50m)", () => {
  assertEquals(roundSwimDistance(387), 400);
});

Deno.test("roundSwimDistance - 1125 → 1150 (rounds to nearest 50m)", () => {
  assertEquals(roundSwimDistance(1125), 1150);
});

Deno.test("roundSwimDistance - 2220 → 2200 (rounds to nearest 50m)", () => {
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

Deno.test("roundSwimDistance - 50 → 50 (already rounded)", () => {
  assertEquals(roundSwimDistance(50), 50);
});

Deno.test("roundSwimDistance - 475 → 500", () => {
  assertEquals(roundSwimDistance(475), 500);
});

// --- roundRunDistance ---

Deno.test("roundRunDistance - 5.23 → 5.2 (rounds to nearest 0.1 km)", () => {
  assertEquals(roundRunDistance(5.23), 5.2);
});

Deno.test("roundRunDistance - 1.37 → 1.4 (rounds to nearest 0.1 km)", () => {
  assertEquals(roundRunDistance(1.37), 1.4);
});

Deno.test("roundRunDistance - 0 → 0", () => {
  assertEquals(roundRunDistance(0), 0);
});

Deno.test("roundRunDistance - 10.05 → 10.1 (midpoint rounds up)", () => {
  assertEquals(roundRunDistance(10.05), 10.1);
});

Deno.test("roundRunDistance - 3.14 → 3.1", () => {
  assertEquals(roundRunDistance(3.14), 3.1);
});

Deno.test("roundRunDistance - 0.99 → 1.0", () => {
  assertEquals(roundRunDistance(0.99), 1.0);
});

// --- buildSegments ---

Deno.test("buildSegments - simple run-swim-run produces 3 segments", () => {
  const trackpoints: Trackpoint[] = [];
  for (let i = 0; i < 10; i++) {
    trackpoints.push(makeTrackpoint(i, 45.0 + i * 0.001, 5.0));
  }
  const classifiedWaypoints: ClassifiedWaypoint[] = [
    {
      waypoint: makeWaypoint({
        symbol: "200",
        coordinate: { lat: 45.003, lon: 5.0 },
      }),
      type: "swim-start",
    },
    {
      waypoint: makeWaypoint({
        symbol: "201",
        coordinate: { lat: 45.006, lon: 5.0 },
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

  // Segments are numbered sequentially
  assertEquals(result.value[0].number, 1);
  assertEquals(result.value[1].number, 2);
  assertEquals(result.value[2].number, 3);
});

Deno.test("buildSegments - segments have calculated distances", () => {
  const trackpoints: Trackpoint[] = [];
  for (let i = 0; i < 10; i++) {
    trackpoints.push(makeTrackpoint(i, 45.0 + i * 0.001, 5.0));
  }
  const classifiedWaypoints: ClassifiedWaypoint[] = [
    {
      waypoint: makeWaypoint({
        symbol: "200",
        coordinate: { lat: 45.003, lon: 5.0 },
      }),
      type: "swim-start",
    },
    {
      waypoint: makeWaypoint({
        symbol: "201",
        coordinate: { lat: 45.006, lon: 5.0 },
      }),
      type: "swim-end",
    },
  ];

  const result = buildSegments(trackpoints, classifiedWaypoints);
  assertEquals(result.ok, true);
  if (!result.ok) return;

  // All segments should have positive distances
  for (const seg of result.value) {
    assertEquals(seg.distanceKm > 0, true);
  }
});

Deno.test("buildSegments - no swim waypoints → single run segment", () => {
  const trackpoints: Trackpoint[] = [];
  for (let i = 0; i < 5; i++) {
    trackpoints.push(makeTrackpoint(i, 45.0 + i * 0.001, 5.0));
  }
  const classifiedWaypoints: ClassifiedWaypoint[] = [];

  const result = buildSegments(trackpoints, classifiedWaypoints);
  assertEquals(result.ok, true);
  if (!result.ok) return;

  assertEquals(result.value.length, 1);
  assertEquals(result.value[0].type, "run");
  assertEquals(result.value[0].number, 1);
});

Deno.test("buildSegments - empty trackpoints → error result", () => {
  const result = buildSegments([], []);
  assertEquals(result.ok, false);
});

Deno.test("buildSegments - segments are non-overlapping and contiguous", () => {
  const trackpoints: Trackpoint[] = [];
  for (let i = 0; i < 20; i++) {
    trackpoints.push(makeTrackpoint(i, 45.0 + i * 0.0005, 5.0));
  }
  const classifiedWaypoints: ClassifiedWaypoint[] = [
    {
      waypoint: makeWaypoint({
        symbol: "200",
        coordinate: { lat: 45.003, lon: 5.0 },
      }),
      type: "swim-start",
    },
    {
      waypoint: makeWaypoint({
        symbol: "201",
        coordinate: { lat: 45.005, lon: 5.0 },
      }),
      type: "swim-end",
    },
    {
      waypoint: makeWaypoint({
        symbol: "200",
        coordinate: { lat: 45.007, lon: 5.0 },
      }),
      type: "swim-start",
    },
    {
      waypoint: makeWaypoint({
        symbol: "201",
        coordinate: { lat: 45.009, lon: 5.0 },
      }),
      type: "swim-end",
    },
  ];

  const result = buildSegments(trackpoints, classifiedWaypoints);
  assertEquals(result.ok, true);
  if (!result.ok) return;

  // Check contiguity: each segment starts where the previous ended (+1)
  for (let i = 1; i < result.value.length; i++) {
    assertEquals(
      result.value[i].startTrackpointIndex,
      result.value[i - 1].endTrackpointIndex + 1,
    );
  }

  // First segment starts at 0, last ends at trackpoints.length - 1
  assertEquals(result.value[0].startTrackpointIndex, 0);
  assertEquals(
    result.value[result.value.length - 1].endTrackpointIndex,
    trackpoints.length - 1,
  );
});

Deno.test("buildSegments - segments alternate between run and swim", () => {
  const trackpoints: Trackpoint[] = [];
  for (let i = 0; i < 20; i++) {
    trackpoints.push(makeTrackpoint(i, 45.0 + i * 0.0005, 5.0));
  }
  const classifiedWaypoints: ClassifiedWaypoint[] = [
    {
      waypoint: makeWaypoint({
        symbol: "200",
        coordinate: { lat: 45.003, lon: 5.0 },
      }),
      type: "swim-start",
    },
    {
      waypoint: makeWaypoint({
        symbol: "201",
        coordinate: { lat: 45.005, lon: 5.0 },
      }),
      type: "swim-end",
    },
  ];

  const result = buildSegments(trackpoints, classifiedWaypoints);
  assertEquals(result.ok, true);
  if (!result.ok) return;

  // Adjacent segments must have different types
  for (let i = 1; i < result.value.length; i++) {
    assertEquals(result.value[i].type !== result.value[i - 1].type, true);
  }
});

// --- pairSegmentsForDisplay ---

Deno.test("pairSegmentsForDisplay - run-first (default): pairs run N + swim N", () => {
  const segments: Segment[] = [
    makeSegment({ number: 1, type: "run", distanceKm: 5.23 }),
    makeSegment({ number: 2, type: "swim", distanceKm: 0.387 }),
    makeSegment({ number: 3, type: "run", distanceKm: 1.37 }),
    makeSegment({ number: 4, type: "swim", distanceKm: 2.22 }),
  ];

  const pairs = pairSegmentsForDisplay(segments, false);
  assertEquals(pairs.length, 2);

  // Row 1: run 1 + swim 2
  assertEquals(pairs[0].number, 1);
  assertEquals(pairs[0].runDistanceKm, "5.2");
  assertEquals(pairs[0].swimDistanceM, "400");

  // Row 2: run 3 + swim 4
  assertEquals(pairs[1].number, 2);
  assertEquals(pairs[1].runDistanceKm, "1.4");
  assertEquals(pairs[1].swimDistanceM, "2200");
});

Deno.test("pairSegmentsForDisplay - run-first: trailing run has swim as '—'", () => {
  const segments: Segment[] = [
    makeSegment({ number: 1, type: "run", distanceKm: 5.0 }),
    makeSegment({ number: 2, type: "swim", distanceKm: 0.4 }),
    makeSegment({ number: 3, type: "run", distanceKm: 3.0 }),
  ];

  const pairs = pairSegmentsForDisplay(segments, false);
  assertEquals(pairs.length, 2);

  // Row 1: run + swim
  assertEquals(pairs[0].runDistanceKm, "5.0");
  assertEquals(pairs[0].swimDistanceM, "400");

  // Row 2: run only, no swim
  assertEquals(pairs[1].runDistanceKm, "3.0");
  assertEquals(pairs[1].swimDistanceM, "—");
});

Deno.test("pairSegmentsForDisplay - swim-first: pairs swim N + run N", () => {
  const segments: Segment[] = [
    makeSegment({ number: 1, type: "swim", distanceKm: 0.4 }),
    makeSegment({ number: 2, type: "run", distanceKm: 5.23 }),
    makeSegment({ number: 3, type: "swim", distanceKm: 2.22 }),
    makeSegment({ number: 4, type: "run", distanceKm: 1.37 }),
  ];

  const pairs = pairSegmentsForDisplay(segments, true);
  assertEquals(pairs.length, 2);

  // Row 1: swim 1 + run 2
  assertEquals(pairs[0].swimDistanceM, "400");
  assertEquals(pairs[0].runDistanceKm, "5.2");

  // Row 2: swim 3 + run 4
  assertEquals(pairs[1].swimDistanceM, "2200");
  assertEquals(pairs[1].runDistanceKm, "1.4");
});

Deno.test("pairSegmentsForDisplay - swim-first: race starting with run uses '—' for swim", () => {
  // swimFirst=true but race starts with a run — the first row should have "—" for swim
  const segments: Segment[] = [
    makeSegment({ number: 1, type: "run", distanceKm: 5.0 }),
    makeSegment({ number: 2, type: "swim", distanceKm: 0.4 }),
    makeSegment({ number: 3, type: "run", distanceKm: 3.0 }),
  ];

  const pairs = pairSegmentsForDisplay(segments, true);
  // In swim-first mode with a leading run: first row has "—" for swim, the run value
  assertEquals(pairs[0].swimDistanceM, "—");
  assertEquals(pairs[0].runDistanceKm, "5.0");
});

Deno.test("pairSegmentsForDisplay - run-first: race starting with swim uses '—' for run", () => {
  // runFirst (swimFirst=false) but race starts with a swim — the first row has "—" for run
  const segments: Segment[] = [
    makeSegment({ number: 1, type: "swim", distanceKm: 0.4 }),
    makeSegment({ number: 2, type: "run", distanceKm: 5.0 }),
    makeSegment({ number: 3, type: "swim", distanceKm: 0.3 }),
  ];

  const pairs = pairSegmentsForDisplay(segments, false);
  assertEquals(pairs[0].runDistanceKm, "—");
  assertEquals(pairs[0].swimDistanceM, "400");
});

Deno.test("pairSegmentsForDisplay - single segment produces one row with dash", () => {
  const segments: Segment[] = [
    makeSegment({ number: 1, type: "run", distanceKm: 5.23 }),
  ];

  const pairs = pairSegmentsForDisplay(segments, false);
  assertEquals(pairs.length, 1);
  assertEquals(pairs[0].runDistanceKm, "5.2");
  assertEquals(pairs[0].swimDistanceM, "—");
});

// --- calculateTotals ---

Deno.test("calculateTotals - sums all swim and run distances independently", () => {
  const segments: Segment[] = [
    makeSegment({ number: 1, type: "run", distanceKm: 5.23 }),
    makeSegment({ number: 2, type: "swim", distanceKm: 0.387 }),
    makeSegment({ number: 3, type: "run", distanceKm: 1.37 }),
    makeSegment({ number: 4, type: "swim", distanceKm: 2.22 }),
  ];

  const totals = calculateTotals(segments);
  // Total run: 5.23 + 1.37 = 6.6 km → "6.6"
  assertEquals(totals.totalRunKm, "6.6");
  // Total swim: (387 + 2220) m = 2607m → rounded to nearest 50 → 2600 → "2600"
  // Actually: totals sum the raw distances then round
  // 0.387 km = 387m, 2.22 km = 2220m → total = 2607m → rounded to 50 = 2600
  assertEquals(totals.totalSwimM, "2600");
});

Deno.test("calculateTotals - no segments → zeroes", () => {
  const totals = calculateTotals([]);
  assertEquals(totals.totalRunKm, "0.0");
  assertEquals(totals.totalSwimM, "0");
});

Deno.test("calculateTotals - only run segments → swim total is 0", () => {
  const segments: Segment[] = [
    makeSegment({ number: 1, type: "run", distanceKm: 5.0 }),
    makeSegment({ number: 2, type: "run", distanceKm: 3.0 }),
  ];

  const totals = calculateTotals(segments);
  assertEquals(totals.totalRunKm, "8.0");
  assertEquals(totals.totalSwimM, "0");
});

// --- Property-Based Tests ---

/**
 * Generate an array of trackpoints with sequential indices and coordinates
 * spaced at ~100m intervals along a North-South line.
 * This ensures that waypoints placed at a trackpoint's coordinate will
 * map to the correct trackpoint via findNearestTrackpoint (50m radius).
 */
const arbitraryTrackpointArray = fc
  .nat({ max: 98 })
  .map((extraCount) => {
    const count = extraCount + 2; // 2..100 trackpoints
    const baseLat = 45.0;
    const baseLon = 5.0;
    // ~0.001 degrees latitude ≈ 111m apart — well outside 50m matching radius
    return Array.from({ length: count }, (_, i) => ({
      coordinate: { lat: baseLat + i * 0.001, lon: baseLon },
      elevation: 100,
      timestamp: null,
      index: i,
    }));
  });

/**
 * Generate a valid set of swim pairs as indices into a trackpoint array.
 * Each pair [startIdx, endIdx] satisfies startIdx < endIdx,
 * pairs are non-overlapping and ordered, and there's at least 1 trackpoint
 * gap between consecutive pairs (to allow a run segment in between).
 *
 * This models "valid" swim pairs where each swim is separated by at least
 * one run trackpoint, as required by Property 5's precondition.
 */
function arbitrarySwimPairs(
  trackpointCount: number,
): fc.Arbitrary<[number, number][]> {
  if (trackpointCount < 3) {
    // Not enough room for a swim pair with surrounding run segments
    return fc.constant([]);
  }
  const maxPairs = Math.min(5, Math.floor((trackpointCount - 1) / 3));
  return fc
    .array(
      fc.tuple(
        fc.nat({ max: trackpointCount - 2 }),
        fc.nat({ max: trackpointCount - 1 }),
      ),
      { minLength: 0, maxLength: maxPairs },
    )
    .map((rawPairs) => {
      // Sort by start, ensure start < end, filter overlaps
      const sorted = rawPairs
        .map(([a, b]) => [Math.min(a, b), Math.max(a, b)] as [number, number])
        .filter(([a, b]) => a < b)
        .sort((a, b) => a[0] - b[0]);

      // Remove overlapping pairs and ensure at least 1 trackpoint gap
      // between consecutive swim pairs (so a run segment can exist between them)
      const result: [number, number][] = [];
      for (const pair of sorted) {
        if (
          result.length === 0 ||
          pair[0] > result[result.length - 1][1] + 1
        ) {
          result.push(pair);
        }
      }
      return result;
    });
}

/**
 * Build classified waypoints from swim pairs.
 * Maps pair indices to trackpoint coordinates for waypoint placement.
 */
function buildClassifiedWaypointsFromPairs(
  trackpoints: { coordinate: { lat: number; lon: number }; elevation: number; timestamp: null; index: number }[],
  swimPairs: [number, number][],
) {
  const classifiedWaypoints = [];
  for (const [startIdx, endIdx] of swimPairs) {
    classifiedWaypoints.push({
      waypoint: {
        coordinate: trackpoints[startIdx].coordinate,
        elevation: 100,
        name: "",
        symbol: "200",
        description: "",
      },
      type: "swim-start" as const,
    });
    classifiedWaypoints.push({
      waypoint: {
        coordinate: trackpoints[endIdx].coordinate,
        elevation: 100,
        name: "",
        symbol: "201",
        description: "",
      },
      type: "swim-end" as const,
    });
  }
  return classifiedWaypoints;
}

// --- Property 5: Segmentation produces complete, non-overlapping, alternating coverage ---
// **Validates: Requirements 2.3, 2.4, 2.5, 2.6, 2.7**

Deno.test("Property 5.1: First segment starts at index 0", () => {
  fc.assert(
    fc.property(
      arbitraryTrackpointArray.chain((trackpoints) =>
        arbitrarySwimPairs(trackpoints.length).map((pairs) => ({
          trackpoints,
          pairs,
        }))
      ),
      ({ trackpoints, pairs }) => {
        const classifiedWaypoints = buildClassifiedWaypointsFromPairs(
          trackpoints,
          pairs,
        );
        const result = buildSegments(trackpoints, classifiedWaypoints);
        if (!result.ok) return; // skip error results (shouldn't happen with valid input)

        assert(
          result.value[0].startTrackpointIndex === 0,
          `First segment should start at 0, got ${result.value[0].startTrackpointIndex}`,
        );
      },
    ),
    { numRuns: 100 },
  );
});

Deno.test("Property 5.2: Last segment ends at trackpoints.length - 1", () => {
  fc.assert(
    fc.property(
      arbitraryTrackpointArray.chain((trackpoints) =>
        arbitrarySwimPairs(trackpoints.length).map((pairs) => ({
          trackpoints,
          pairs,
        }))
      ),
      ({ trackpoints, pairs }) => {
        const classifiedWaypoints = buildClassifiedWaypointsFromPairs(
          trackpoints,
          pairs,
        );
        const result = buildSegments(trackpoints, classifiedWaypoints);
        if (!result.ok) return;

        const lastSegment = result.value[result.value.length - 1];
        assert(
          lastSegment.endTrackpointIndex === trackpoints.length - 1,
          `Last segment should end at ${trackpoints.length - 1}, got ${lastSegment.endTrackpointIndex}`,
        );
      },
    ),
    { numRuns: 100 },
  );
});

Deno.test("Property 5.3: Each segment starts where the previous one ended + 1 (contiguous, non-overlapping)", () => {
  fc.assert(
    fc.property(
      arbitraryTrackpointArray.chain((trackpoints) =>
        arbitrarySwimPairs(trackpoints.length).map((pairs) => ({
          trackpoints,
          pairs,
        }))
      ),
      ({ trackpoints, pairs }) => {
        const classifiedWaypoints = buildClassifiedWaypointsFromPairs(
          trackpoints,
          pairs,
        );
        const result = buildSegments(trackpoints, classifiedWaypoints);
        if (!result.ok) return;

        for (let i = 1; i < result.value.length; i++) {
          assert(
            result.value[i].startTrackpointIndex ===
              result.value[i - 1].endTrackpointIndex + 1,
            `Segment ${i} should start at ${result.value[i - 1].endTrackpointIndex + 1}, got ${result.value[i].startTrackpointIndex}`,
          );
        }
      },
    ),
    { numRuns: 100 },
  );
});

Deno.test("Property 5.4: No two adjacent segments have the same type (alternating)", () => {
  fc.assert(
    fc.property(
      arbitraryTrackpointArray.chain((trackpoints) =>
        arbitrarySwimPairs(trackpoints.length).map((pairs) => ({
          trackpoints,
          pairs,
        }))
      ),
      ({ trackpoints, pairs }) => {
        const classifiedWaypoints = buildClassifiedWaypointsFromPairs(
          trackpoints,
          pairs,
        );
        const result = buildSegments(trackpoints, classifiedWaypoints);
        if (!result.ok) return;

        for (let i = 1; i < result.value.length; i++) {
          assert(
            result.value[i].type !== result.value[i - 1].type,
            `Adjacent segments ${i - 1} and ${i} should have different types, both are "${result.value[i].type}"`,
          );
        }
      },
    ),
    { numRuns: 100 },
  );
});
