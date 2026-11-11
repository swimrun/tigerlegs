import fc from "fast-check";
import { expect, it } from "vitest";
import {
  calculateTotals,
  pairSegmentsForDisplay,
  roundRunDistance,
  roundSwimDistance,
} from "../../src/client/segment-builder.ts";
import type { Segment, SegmentType } from "../../src/shared/types.ts";

// --- Generators ---

/** Generate a valid Segment with the given type */
function arbitrarySegment(type: SegmentType, number: number): fc.Arbitrary<Segment> {
  return fc.record({
    number: fc.constant(number),
    type: fc.constant(type),
    startTrackpointIndex: fc.nat({ max: 10000 }),
    endTrackpointIndex: fc.nat({ max: 10000 }),
    distanceKm: fc.double({ min: 0.001, max: 50, noNaN: true }),
    detectedBy: fc.constant(["waypoint"] as Segment["detectedBy"]),
    confidenceScore: fc.double({ min: 0, max: 1, noNaN: true }),
    gpsFiltered: fc.boolean(),
  });
}

/** Generate a valid alternating Segment array (run/swim or swim/run) */
const arbitrarySegmentArray: fc.Arbitrary<Segment[]> = fc
  .tuple(
    fc.boolean(), // swimFirst
    fc.nat({ max: 9 }), // extra segment count (0..9 → total 1..10)
  )
  .chain(([swimFirst, extraCount]) => {
    const count = extraCount + 1;
    const types: SegmentType[] = [];
    for (let i = 0; i < count; i++) {
      types.push(i % 2 === 0 ? (swimFirst ? "swim" : "run") : (swimFirst ? "run" : "swim"));
    }
    const arbitraries = types.map((type, i) => arbitrarySegment(type, i + 1));
    return fc.tuple(...arbitraries).map((segs) => segs as Segment[]);
  });

// --- Property 10: Segment display formatting follows type-specific rules ---
// **Validates: Requirements 3.5, 3.6, 3.7, 5.1**

it("Property 10.1: roundSwimDistance always produces a multiple of 50", () => {
  fc.assert(fc.property(
      fc.double({ min: 0, max: 100000, noNaN: true }),
      (metres) => {
        const rounded = roundSwimDistance(metres);
        expect(rounded % 50 === 0, `roundSwimDistance(${metres}) = ${rounded}, expected multiple of 50`).toBeTruthy();
      },
    ), { numRuns: 200 });
});

it("Property 10.2: roundRunDistance always produces a value with exactly 1 decimal place when formatted", () => {
  fc.assert(fc.property(
      fc.double({ min: 0, max: 1000, noNaN: true }),
      (km) => {
        const rounded = roundRunDistance(km);
        const formatted = rounded.toFixed(1);
        // Verify the formatted string has exactly one decimal place
        const parts = formatted.split(".");
        expect(parts.length === 2 && parts[1].length === 1, `roundRunDistance(${km}).toFixed(1) = "${formatted}", expected exactly 1 decimal place`).toBeTruthy();
        // Verify parsing back gives the same value (no precision loss)
        expect(parseFloat(formatted), `Parsing "${formatted}" back should equal ${rounded}`).toEqual(rounded);
      },
    ), { numRuns: 200 });
});

it("Property 10.3: pairSegmentsForDisplay never produces empty strings (always a number or '—')", () => {
  fc.assert(fc.property(
      arbitrarySegmentArray,
      fc.boolean(),
      (segments, swimFirst) => {
        const pairs = pairSegmentsForDisplay(segments, swimFirst);

        for (const pair of pairs) {
          // swimDistanceM must be non-empty
          expect(pair.swimDistanceM.length > 0, `swimDistanceM should not be empty, got ""`).toBeTruthy();
          // runDistanceKm must be non-empty
          expect(pair.runDistanceKm.length > 0, `runDistanceKm should not be empty, got ""`).toBeTruthy();
          // Each value must be either "—" or a valid number string
          if (pair.swimDistanceM !== "—") {
            const parsed = Number(pair.swimDistanceM);
            expect(!isNaN(parsed), `swimDistanceM "${pair.swimDistanceM}" should be a valid number or "—"`).toBeTruthy();
          }
          if (pair.runDistanceKm !== "—") {
            const parsed = Number(pair.runDistanceKm);
            expect(!isNaN(parsed), `runDistanceKm "${pair.runDistanceKm}" should be a valid number or "—"`).toBeTruthy();
          }
        }
      },
    ), { numRuns: 100 });
});

it("Property 10.4: calculateTotals produces strings that are valid numbers", () => {
  fc.assert(fc.property(
      arbitrarySegmentArray,
      (segments) => {
        const totals = calculateTotals(segments);

        // totalRunKm should be a valid number
        const runVal = Number(totals.totalRunKm);
        expect(!isNaN(runVal), `totalRunKm "${totals.totalRunKm}" should be a valid number`).toBeTruthy();
        expect(runVal >= 0, `totalRunKm should be non-negative, got ${runVal}`).toBeTruthy();

        // totalSwimM should be a valid number
        const swimVal = Number(totals.totalSwimM);
        expect(!isNaN(swimVal), `totalSwimM "${totals.totalSwimM}" should be a valid number`).toBeTruthy();
        expect(swimVal >= 0, `totalSwimM should be non-negative, got ${swimVal}`).toBeTruthy();

        // totalRunKm should have exactly 1 decimal place
        const parts = totals.totalRunKm.split(".");
        expect(parts.length === 2 && parts[1].length === 1, `totalRunKm "${totals.totalRunKm}" should have exactly 1 decimal place`).toBeTruthy();

        // totalSwimM should be a multiple of 50 (swim rounding rule)
        expect(swimVal % 50 === 0, `totalSwimM ${swimVal} should be a multiple of 50`).toBeTruthy();
      },
    ), { numRuns: 100 });
});
