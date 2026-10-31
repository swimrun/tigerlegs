import fc from "fast-check";
import { assert, assertEquals } from "@std/assert";
import {
  computeScatterRatio,
  filterSwimSegment,
  smoothPath,
} from "../../src/client/gps-filter.ts";
import type { Trackpoint } from "../../src/shared/types.ts";

// --- Helpers ---

function makeTrackpoint(
  index: number,
  lat: number,
  lon: number,
): Trackpoint {
  return {
    coordinate: { lat, lon },
    elevation: 0,
    timestamp: null,
    index,
  };
}

/**
 * Generate trackpoints along a straight line between two points.
 */
function makeStraightLine(
  startLat: number,
  startLon: number,
  endLat: number,
  endLon: number,
  count: number,
): Trackpoint[] {
  const trackpoints: Trackpoint[] = [];
  for (let i = 0; i < count; i++) {
    const t = count > 1 ? i / (count - 1) : 0;
    const lat = startLat + t * (endLat - startLat);
    const lon = startLon + t * (endLon - startLon);
    trackpoints.push(makeTrackpoint(i, lat, lon));
  }
  return trackpoints;
}

/**
 * Arbitrary generator for a path with distinct start and end coordinates.
 * Generates trackpoints along a line with controlled noise levels.
 * The noise is applied perpendicularly to the direction of travel.
 */
function arbitraryPathWithNoise(opts: {
  minPoints: number;
  maxPoints: number;
  minDistanceDeg: number;
  maxNoiseDeg: number;
}): fc.Arbitrary<Trackpoint[]> {
  return fc
    .record({
      startLat: fc.double({ min: -80, max: 80, noNaN: true }),
      startLon: fc.double({ min: -170, max: 170, noNaN: true }),
      // Ensure distinct start/end by adding a positive offset
      latOffset: fc.double({
        min: opts.minDistanceDeg,
        max: opts.minDistanceDeg * 10,
        noNaN: true,
      }),
      lonOffset: fc.double({
        min: -opts.minDistanceDeg * 5,
        max: opts.minDistanceDeg * 5,
        noNaN: true,
      }),
      count: fc.integer({ min: opts.minPoints, max: opts.maxPoints }),
      noiseValues: fc.array(
        fc.double({ min: -opts.maxNoiseDeg, max: opts.maxNoiseDeg, noNaN: true }),
        { minLength: opts.maxPoints, maxLength: opts.maxPoints },
      ),
    })
    .map(({ startLat, startLon, latOffset, lonOffset, count, noiseValues }) => {
      const endLat = Math.max(-89, Math.min(89, startLat + latOffset));
      const endLon = Math.max(-179, Math.min(179, startLon + lonOffset));
      const trackpoints: Trackpoint[] = [];

      for (let i = 0; i < count; i++) {
        const t = count > 1 ? i / (count - 1) : 0;
        const baseLat = startLat + t * (endLat - startLat);
        const baseLon = startLon + t * (endLon - startLon);

        // Don't add noise to start and end points
        if (i === 0 || i === count - 1) {
          trackpoints.push(makeTrackpoint(i, baseLat, baseLon));
        } else {
          // Add noise perpendicular to direction of travel
          const noise = noiseValues[i] || 0;
          // For a primarily lat-direction path, add noise to lon
          trackpoints.push(makeTrackpoint(i, baseLat, baseLon + noise));
        }
      }

      return trackpoints;
    });
}

/**
 * Arbitrary generator for a path where start and end are very close (< 5m apart).
 * This generates paths with straight-line distance < 5m (0.005 km).
 */
function arbitraryShortPath(): fc.Arbitrary<Trackpoint[]> {
  return fc
    .record({
      baseLat: fc.double({ min: -80, max: 80, noNaN: true }),
      baseLon: fc.double({ min: -170, max: 170, noNaN: true }),
      count: fc.integer({ min: 3, max: 15 }),
      // Very small offset ensures straight-line < 5m
      // 0.00004 degrees ≈ 4.4m at equator, less at higher latitudes
      latOffset: fc.double({ min: -0.00003, max: 0.00003, noNaN: true }),
      lonOffset: fc.double({ min: -0.00003, max: 0.00003, noNaN: true }),
    })
    .map(({ baseLat, baseLon, count, latOffset, lonOffset }) => {
      const trackpoints: Trackpoint[] = [];
      for (let i = 0; i < count; i++) {
        const t = count > 1 ? i / (count - 1) : 0;
        trackpoints.push(
          makeTrackpoint(i, baseLat + t * latOffset, baseLon + t * lonOffset),
        );
      }
      return trackpoints;
    });
}

/**
 * Arbitrary generator for a clean path with low scatter (scatter ≤ 1.5).
 * Generates nearly straight paths with minimal noise.
 */
function arbitraryLowScatterPath(): fc.Arbitrary<Trackpoint[]> {
  return arbitraryPathWithNoise({
    minPoints: 5,
    maxPoints: 30,
    minDistanceDeg: 0.001, // ~111m at equator, ensures > 5m straight-line
    maxNoiseDeg: 0.00001, // negligible noise (~1m)
  });
}

// --- Property 16: GPS filter scatter ratio and method selection ---
// **Validates: Requirements 13.1, 13.3, 13.4, 13.5, 13.6, 13.7, 13.8**

Deno.test("Property 16.1: computeScatterRatio is always ≥ 1.0 for paths with distinct start/end", () => {
  fc.assert(
    fc.property(
      arbitraryPathWithNoise({
        minPoints: 3,
        maxPoints: 30,
        minDistanceDeg: 0.001, // ensures distinct start/end (~111m)
        maxNoiseDeg: 0.005, // moderate noise
      }),
      (trackpoints) => {
        const ratio = computeScatterRatio(trackpoints, 0, trackpoints.length - 1);

        // By the triangle inequality, the cumulative point-to-point distance
        // is always >= straight-line distance, so ratio >= 1.0.
        // Allow a tiny epsilon for floating-point imprecision in haversine
        // (summing multiple small segments can lose precision vs one large segment).
        assert(
          ratio >= 1.0 - 1e-10,
          `Scatter ratio should be >= 1.0 (triangle inequality), got ${ratio}`,
        );
      },
    ),
    { numRuns: 200 },
  );
});

Deno.test("Property 16.2: filterSwimSegment with scatterRatio ≤ 1.5 always returns filterMethod 'none'", () => {
  fc.assert(
    fc.property(
      arbitraryLowScatterPath(),
      (trackpoints) => {
        const result = filterSwimSegment(trackpoints, 0, trackpoints.length - 1);

        // If scatter ratio ≤ 1.5 (and the segment is long enough for filtering),
        // the filter method must be "none"
        if (result.scatterRatio <= 1.5 && result.scatterRatio !== Infinity) {
          assertEquals(
            result.filterMethod,
            "none",
            `When scatterRatio=${result.scatterRatio} (≤ 1.5), filterMethod should be "none", got "${result.filterMethod}"`,
          );
        }
      },
    ),
    { numRuns: 200 },
  );
});

Deno.test("Property 16.3: filterSwimSegment never mutates input trackpoints", () => {
  fc.assert(
    fc.property(
      arbitraryPathWithNoise({
        minPoints: 5,
        maxPoints: 25,
        minDistanceDeg: 0.001,
        maxNoiseDeg: 0.005,
      }),
      (trackpoints) => {
        // Deep copy original state for comparison
        const originalCoords = trackpoints.map((tp) => ({
          lat: tp.coordinate.lat,
          lon: tp.coordinate.lon,
          elevation: tp.elevation,
          timestamp: tp.timestamp,
          index: tp.index,
        }));

        // Run the filter
        filterSwimSegment(trackpoints, 0, trackpoints.length - 1);

        // Verify nothing was mutated
        assertEquals(
          trackpoints.length,
          originalCoords.length,
          "Array length should not change",
        );
        for (let i = 0; i < trackpoints.length; i++) {
          assertEquals(
            trackpoints[i].coordinate.lat,
            originalCoords[i].lat,
            `Trackpoint ${i} lat was mutated`,
          );
          assertEquals(
            trackpoints[i].coordinate.lon,
            originalCoords[i].lon,
            `Trackpoint ${i} lon was mutated`,
          );
          assertEquals(
            trackpoints[i].elevation,
            originalCoords[i].elevation,
            `Trackpoint ${i} elevation was mutated`,
          );
          assertEquals(
            trackpoints[i].timestamp,
            originalCoords[i].timestamp,
            `Trackpoint ${i} timestamp was mutated`,
          );
          assertEquals(
            trackpoints[i].index,
            originalCoords[i].index,
            `Trackpoint ${i} index was mutated`,
          );
        }
      },
    ),
    { numRuns: 200 },
  );
});

Deno.test("Property 16.4: filterSwimSegment filteredDistance is always ≤ originalDistance", () => {
  fc.assert(
    fc.property(
      arbitraryPathWithNoise({
        minPoints: 5,
        maxPoints: 30,
        minDistanceDeg: 0.001,
        maxNoiseDeg: 0.01, // larger noise to trigger filtering
      }),
      (trackpoints) => {
        const result = filterSwimSegment(trackpoints, 0, trackpoints.length - 1);

        assert(
          result.filteredDistance <= result.originalDistance + 1e-10,
          `filteredDistance (${result.filteredDistance}) should be ≤ originalDistance (${result.originalDistance})`,
        );
      },
    ),
    { numRuns: 200 },
  );
});

Deno.test("Property 16.5: smoothPath output length equals input length", () => {
  fc.assert(
    fc.property(
      arbitraryPathWithNoise({
        minPoints: 1,
        maxPoints: 50,
        minDistanceDeg: 0.0001,
        maxNoiseDeg: 0.005,
      }),
      fc.integer({ min: 1, max: 11 }),
      (trackpoints, windowSize) => {
        const result = smoothPath(trackpoints, windowSize);
        assertEquals(
          result.length,
          trackpoints.length,
          `smoothPath output length (${result.length}) should equal input length (${trackpoints.length})`,
        );
      },
    ),
    { numRuns: 200 },
  );
});

Deno.test("Property 16.6: For segments with straight-line < 5m, filterMethod is always 'none'", () => {
  fc.assert(
    fc.property(
      arbitraryShortPath(),
      (trackpoints) => {
        const result = filterSwimSegment(trackpoints, 0, trackpoints.length - 1);

        assertEquals(
          result.filterMethod,
          "none",
          `For short segments (straight-line < 5m), filterMethod should be "none", got "${result.filterMethod}" with scatterRatio=${result.scatterRatio}`,
        );
      },
    ),
    { numRuns: 200 },
  );
});
