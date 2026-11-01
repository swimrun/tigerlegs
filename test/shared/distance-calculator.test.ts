/**
 * Property-based tests for the distance calculator module.
 *
 * Properties 7, 8, 9 from the design document.
 * Validates: Requirements 3.1, 3.2, 3.3, 3.4
 */
import { assertEquals, assertLessOrEqual } from "@std/assert";
import fc from "fast-check";
import {
  calculateTrackDistance,
  findNearestTrackpoint,
  haversineDistance,
} from "../../src/shared/distance-calculator.ts";
import type { Coordinate, Trackpoint } from "../../src/shared/types.ts";
import { arbitraryCoordinate, arbitraryTrackpoint } from "../generators.ts";

/**
 * Property 7: Haversine distance satisfies metric space axioms
 *
 * For any coordinates A, B, and C:
 * 1. haversineDistance(A, B) >= 0 (non-negativity)
 * 2. haversineDistance(A, A) == 0 (identity of indiscernibles)
 * 3. haversineDistance(A, B) == haversineDistance(B, A) (symmetry)
 * 4. haversineDistance(A, C) <= haversineDistance(A, B) + haversineDistance(B, C) (triangle inequality)
 *
 * **Validates: Requirements 3.1**
 */
Deno.test("Property 7: haversineDistance - non-negativity", () => {
  fc.assert(
    fc.property(arbitraryCoordinate, arbitraryCoordinate, (a, b) => {
      const distance = haversineDistance(a, b);
      return distance >= 0;
    }),
    { numRuns: 200 },
  );
});

Deno.test("Property 7: haversineDistance - identity of indiscernibles", () => {
  fc.assert(
    fc.property(arbitraryCoordinate, (a) => {
      const distance = haversineDistance(a, a);
      return distance === 0;
    }),
    { numRuns: 200 },
  );
});

Deno.test("Property 7: haversineDistance - symmetry", () => {
  fc.assert(
    fc.property(arbitraryCoordinate, arbitraryCoordinate, (a, b) => {
      const dAB = haversineDistance(a, b);
      const dBA = haversineDistance(b, a);
      return Math.abs(dAB - dBA) < 1e-10;
    }),
    { numRuns: 200 },
  );
});

Deno.test("Property 7: haversineDistance - triangle inequality", () => {
  fc.assert(
    fc.property(
      arbitraryCoordinate,
      arbitraryCoordinate,
      arbitraryCoordinate,
      (a, b, c) => {
        const dAC = haversineDistance(a, c);
        const dAB = haversineDistance(a, b);
        const dBC = haversineDistance(b, c);
        // Tolerance accounts for floating-point rounding in near-antipodal cases
        // where distances approach half Earth circumference (~20,000 km) and the
        // haversine error grows to sqrt(machine epsilon) × circumference ≈ 0.3 m,
        // so allow 1 m (CI seed 1099221529 produced a ~7 cm violation).
        const tolerance = 1e-3;
        return dAC <= dAB + dBC + tolerance;
      },
    ),
    { numRuns: 200 },
  );
});

/**
 * Property 8: Distance accumulation is additive over subsequences
 *
 * For any trackpoint sequence [p0, p1, ..., pN] and any split index k (0 < k < N),
 * calculateTrackDistance([p0..pN]) === calculateTrackDistance([p0..pk]) + calculateTrackDistance([pk..pN])
 *
 * **Validates: Requirements 3.2**
 */
Deno.test("Property 8: calculateTrackDistance - additive over subsequences", () => {
  // Generate a track with at least 3 trackpoints (so we can split into two non-trivial parts)
  const arbitraryTrackWithMinPoints = fc
    .array(arbitraryTrackpoint, { minLength: 3, maxLength: 30 })
    .map((trackpoints) =>
      trackpoints.map((tp, i) => ({ ...tp, index: i }))
    );

  fc.assert(
    fc.property(
      arbitraryTrackWithMinPoints,
      fc.nat(),
      (trackpoints, rawK) => {
        // Pick split index k in (0, trackpoints.length - 1) exclusive
        const k = 1 + (rawK % (trackpoints.length - 2));

        const fullDistance = calculateTrackDistance(trackpoints);
        const firstPart = calculateTrackDistance(trackpoints.slice(0, k + 1));
        const secondPart = calculateTrackDistance(trackpoints.slice(k));

        // Allow floating point tolerance
        return Math.abs(fullDistance - (firstPart + secondPart)) < 1e-10;
      },
    ),
    { numRuns: 200 },
  );
});

/**
 * Property 9: Nearest trackpoint search returns closest point within radius
 *
 * If findNearestTrackpoint(C, T, R) returns index i:
 *   - haversineDistance(C, T[i].coordinate) <= R
 *   - No other trackpoint j has haversineDistance(C, T[j].coordinate) < haversineDistance(C, T[i].coordinate)
 *
 * If findNearestTrackpoint(C, T, R) returns null:
 *   - For all trackpoints t in T: haversineDistance(C, t.coordinate) > R
 *
 * **Validates: Requirements 3.3, 3.4**
 */
Deno.test("Property 9: findNearestTrackpoint - returns closest within radius or null", () => {
  const arbitraryTrackpoints = fc
    .array(arbitraryTrackpoint, { minLength: 1, maxLength: 20 })
    .map((trackpoints) =>
      trackpoints.map((tp, i) => ({ ...tp, index: i }))
    );

  // Use a reasonable radius range for testing (0.001 km = 1m to 10 km)
  const arbitraryRadius = fc.double({ min: 0.001, max: 10, noNaN: true });

  fc.assert(
    fc.property(
      arbitraryCoordinate,
      arbitraryTrackpoints,
      arbitraryRadius,
      (coordinate, trackpoints, radius) => {
        const result = findNearestTrackpoint(coordinate, trackpoints, radius);

        if (result !== null) {
          // result is an index - verify it's within radius
          const distToResult = haversineDistance(
            coordinate,
            trackpoints[result].coordinate,
          );

          // Must be within radius
          if (distToResult > radius + 1e-10) return false;

          // Must be closest: no other trackpoint is closer
          for (let j = 0; j < trackpoints.length; j++) {
            if (j === result) continue;
            const distToJ = haversineDistance(
              coordinate,
              trackpoints[j].coordinate,
            );
            if (distToJ < distToResult - 1e-10) return false;
          }

          return true;
        } else {
          // null means no trackpoint is within radius
          for (const tp of trackpoints) {
            const dist = haversineDistance(coordinate, tp.coordinate);
            if (dist <= radius - 1e-10) return false;
          }
          return true;
        }
      },
    ),
    { numRuns: 200 },
  );
});
