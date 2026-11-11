/**
 * Property-based tests for landscape detection (Properties 17 & 18).
 *
 * **Validates: Requirements 14.2, 14.3, 14.4, 14.5, 14.8, 14.9**
 */
import fc from "fast-check";
import { expect, it } from "vitest";
import {
  sampleCoordinates,
  detectByLandscape,
  calculateLandscapeConfidence,
} from "../../src/client/landscape-client.ts";
import { haversineDistance } from "../../src/shared/distance-calculator.ts";
import type { Trackpoint, TerrainResult } from "../../src/shared/types.ts";

// --- Generators ---

/**
 * Generate trackpoints along a line with varying spacing.
 * Uses a base lat/lon and increments latitude by stepDeg per point.
 */
function arbitraryTrackLine(
  minPoints: number,
  maxPoints: number,
): fc.Arbitrary<Trackpoint[]> {
  return fc
    .record({
      count: fc.integer({ min: minPoints, max: maxPoints }),
      startLat: fc.double({ min: -80, max: 80, noNaN: true }),
      startLon: fc.double({ min: -170, max: 170, noNaN: true }),
      // stepDeg between ~5m and ~200m per step
      stepDeg: fc.double({ min: 0.00005, max: 0.002, noNaN: true }),
    })
    .map(({ count, startLat, startLon, stepDeg }) => {
      const trackpoints: Trackpoint[] = [];
      for (let i = 0; i < count; i++) {
        trackpoints.push({
          coordinate: { lat: startLat + i * stepDeg, lon: startLon },
          elevation: 100,
          timestamp: null,
          index: i,
        });
      }
      return trackpoints;
    });
}

/**
 * Generate uniform terrain results for a given number of points.
 * All points have the same terrain type.
 */
function arbitraryUniformTerrainResults(
  terrainType: "water" | "land",
  minCount: number,
  maxCount: number,
): fc.Arbitrary<{ trackpoints: Trackpoint[]; terrainResults: TerrainResult[] }> {
  return arbitraryTrackLine(minCount, maxCount).map((trackpoints) => {
    const terrainResults: TerrainResult[] = trackpoints.map((tp) => ({
      coordinate: { ...tp.coordinate },
      terrainType,
      hasRoadData: false,
    }));
    return { trackpoints, terrainResults };
  });
}

/**
 * Generate terrain results with hasRoadData flag for land points.
 */
function arbitraryLandWithRoadData(
  minCount: number,
  maxCount: number,
): fc.Arbitrary<TerrainResult[]> {
  return fc
    .integer({ min: minCount, max: maxCount })
    .chain((count) =>
      fc
        .array(fc.boolean(), { minLength: count, maxLength: count })
        .map((roadFlags) =>
          roadFlags.map((hasRoad, i) => ({
            coordinate: { lat: 45 + i * 0.0001, lon: 5 },
            terrainType: "land" as const,
            hasRoadData: hasRoad,
          }))
        )
    );
}

// --- Property 17: Coordinate sampling interval constraint ---

it("Property 17.1: sampleCoordinates always includes first and last trackpoint", () => {
  fc.assert(fc.property(arbitraryTrackLine(2, 100), (trackpoints) => {
      const interval = 50; // 50 metres
      const samples = sampleCoordinates(trackpoints, interval);

      // First trackpoint must be first sample
      expect(samples[0].lat).toEqual(trackpoints[0].coordinate.lat);
      expect(samples[0].lon).toEqual(trackpoints[0].coordinate.lon);

      // Last trackpoint must be last sample
      const lastTp = trackpoints[trackpoints.length - 1];
      const lastSample = samples[samples.length - 1];
      expect(lastSample.lat).toEqual(lastTp.coordinate.lat);
      expect(lastSample.lon).toEqual(lastTp.coordinate.lon);
    }), { numRuns: 200 });
});

it("Property 17.2: sampleCoordinates output length is >= 2 for input with >= 2 trackpoints", () => {
  fc.assert(fc.property(arbitraryTrackLine(2, 100), (trackpoints) => {
      const samples = sampleCoordinates(trackpoints, 50);
      expect(samples.length >= 2, `Expected at least 2 samples, got ${samples.length}`).toBeTruthy();
    }), { numRuns: 200 });
});

it("Property 17.3: distance between consecutive samples never exceeds the sampling interval plus the largest trackpoint gap", () => {
  fc.assert(fc.property(
      arbitraryTrackLine(2, 50),
      fc.integer({ min: 10, max: 100 }),
      (trackpoints, intervalMetres) => {
        const samples = sampleCoordinates(trackpoints, intervalMetres);
        const intervalKm = intervalMetres / 1000;
        // Samples are existing trackpoints (no interpolation): a sample is emitted
        // at the first trackpoint where accumulated distance >= interval, so the
        // gap is < interval + the final step. Hence the bound uses the largest step.
        let maxStepKm = 0;
        for (let i = 1; i < trackpoints.length; i++) {
          maxStepKm = Math.max(
            maxStepKm,
            haversineDistance(
              trackpoints[i - 1].coordinate,
              trackpoints[i].coordinate,
            ),
          );
        }
        const epsilon = 1e-6; // 1mm tolerance for floating-point arithmetic
        const maxAllowed = intervalKm + maxStepKm + epsilon;

        for (let i = 1; i < samples.length; i++) {
          const dist = haversineDistance(samples[i - 1], samples[i]);
          expect(dist <= maxAllowed, `Distance between sample ${i - 1} and ${i} is ${dist * 1000}m, ` +
              `exceeds interval + max step of ${maxAllowed * 1000}m`).toBeTruthy();
        }
      },
    ), { numRuns: 200 });
});

// --- Property 18: Landscape segment creation from terrain data ---

it("Property 18.1: detectByLandscape with all-water terrain produces only swim segments", () => {
  fc.assert(fc.property(
      arbitraryUniformTerrainResults("water", 2, 50),
      ({ trackpoints, terrainResults }) => {
        const result = detectByLandscape(trackpoints, terrainResults);
        expect(result.strategy).toEqual("landscape");

        // All segments should be swim
        for (const seg of result.segments) {
          expect(seg.type, `Expected all segments to be swim, got ${seg.type}`).toEqual("swim");
        }

        // Should produce at least one segment (since we have 2+ consecutive water points)
        expect(result.segments.length >= 1, `Expected at least 1 swim segment, got ${result.segments.length}`).toBeTruthy();
      },
    ), { numRuns: 200 });
});

it("Property 18.2: detectByLandscape with all-land terrain produces only run segments", () => {
  fc.assert(fc.property(
      arbitraryUniformTerrainResults("land", 2, 50),
      ({ trackpoints, terrainResults }) => {
        const result = detectByLandscape(trackpoints, terrainResults);
        expect(result.strategy).toEqual("landscape");

        // All segments should be run
        for (const seg of result.segments) {
          expect(seg.type, `Expected all segments to be run, got ${seg.type}`).toEqual("run");
        }

        // Should produce at least one segment
        expect(result.segments.length >= 1, `Expected at least 1 run segment, got ${result.segments.length}`).toBeTruthy();
      },
    ), { numRuns: 200 });
});

it("Property 18.3: calculateLandscapeConfidence always returns value in [0.1, 1.0]", () => {
  // Generate arbitrary terrain results with mixed types
  const arbitraryTerrainPoints = fc.array(
    fc.record({
      coordinate: fc.record({
        lat: fc.double({ min: -90, max: 90, noNaN: true }),
        lon: fc.double({ min: -180, max: 180, noNaN: true }),
      }),
      terrainType: fc.constantFrom("water" as const, "land" as const, "unknown" as const),
      hasRoadData: fc.boolean(),
    }),
    { minLength: 1, maxLength: 50 },
  );

  const arbitrarySegmentType = fc.constantFrom("swim" as const, "run" as const);

  fc.assert(fc.property(
      arbitraryTerrainPoints,
      arbitrarySegmentType,
      (points, segmentType) => {
        const confidence = calculateLandscapeConfidence(points, segmentType);
        expect(confidence >= 0.1, `Confidence ${confidence} is below minimum 0.1`).toBeTruthy();
        expect(confidence <= 1.0, `Confidence ${confidence} exceeds maximum 1.0`).toBeTruthy();
      },
    ), { numRuns: 300 });
});

it("Property 18.4: calculateLandscapeConfidence with hasRoadData for run segments always returns >= 0.9", () => {
  fc.assert(fc.property(
      arbitraryLandWithRoadData(1, 30),
      (points) => {
        // Ensure at least one point has hasRoadData = true
        const hasAnyRoadData = points.some((p) => p.hasRoadData);
        if (!hasAnyRoadData) {
          // Force at least one road data point
          points[0] = { ...points[0], hasRoadData: true };
        }

        const confidence = calculateLandscapeConfidence(points, "run");
        expect(confidence >= 0.9, `Confidence ${confidence} should be >= 0.9 when hasRoadData is true for run segment`).toBeTruthy();
      },
    ), { numRuns: 200 });
});
