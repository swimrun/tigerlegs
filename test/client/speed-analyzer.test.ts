import fc from "fast-check";
import { expect, it } from "vitest";
import {
  calculateInstantaneousSpeed,
  applySlidingWindow,
  detectBySpeed,
  calculateSpeedConfidence,
} from "../../src/client/speed-analyzer.ts";
import { haversineDistance } from "../../src/shared/distance-calculator.ts";
import type { Trackpoint } from "../../src/shared/types.ts";
import { arbitraryCoordinate } from "../generators.ts";

// --- Helpers ---

function makeTrackpoint(overrides: Partial<Trackpoint> = {}): Trackpoint {
  return {
    coordinate: { lat: 45.0, lon: 5.0 },
    elevation: 100,
    timestamp: null,
    index: 0,
    ...overrides,
  };
}

/**
 * Generate a trackpoint with a specific timestamp offset (in seconds) from a base time.
 */
function makeTimedTrackpoint(
  coord: { lat: number; lon: number },
  offsetSeconds: number,
  index: number,
): Trackpoint {
  const baseTime = new Date("2024-01-01T10:00:00Z").getTime();
  return {
    coordinate: coord,
    elevation: 100,
    timestamp: new Date(baseTime + offsetSeconds * 1000).toISOString(),
    index,
  };
}

// --- Property 12: Speed calculation correctness ---
// **Validates: Requirements 12.1, 12.9**

it("Property 12.1: calculateInstantaneousSpeed returns non-negative for valid inputs with positive elapsed time", () => {
  fc.assert(fc.property(
      arbitraryCoordinate,
      arbitraryCoordinate,
      // Generate a positive time offset in seconds (1 to 3600)
      fc.integer({ min: 1, max: 3600 }),
      (coordA, coordB, offsetSeconds) => {
        const baseTime = new Date("2024-01-01T10:00:00Z");
        const a = makeTrackpoint({
          coordinate: coordA,
          timestamp: baseTime.toISOString(),
          index: 0,
        });
        const b = makeTrackpoint({
          coordinate: coordB,
          timestamp: new Date(baseTime.getTime() + offsetSeconds * 1000).toISOString(),
          index: 1,
        });

        const speed = calculateInstantaneousSpeed(a, b);
        expect(speed !== null, "Speed should not be null for valid timestamps with positive elapsed time").toBeTruthy();
        expect(speed >= 0, `Speed should be non-negative, got ${speed}`).toBeTruthy();
      },
    ), { numRuns: 100 });
});

it("Property 12.2: calculateInstantaneousSpeed returns null when timestamp A is missing", () => {
  fc.assert(fc.property(
      arbitraryCoordinate,
      arbitraryCoordinate,
      fc.date({ min: new Date("2020-01-01"), max: new Date("2030-12-31") }),
      (coordA, coordB, dateB) => {
        const a = makeTrackpoint({ coordinate: coordA, timestamp: null, index: 0 });
        const b = makeTrackpoint({ coordinate: coordB, timestamp: dateB.toISOString(), index: 1 });

        const speed = calculateInstantaneousSpeed(a, b);
        expect(speed).toEqual(null);
      },
    ), { numRuns: 100 });
});

it("Property 12.3: calculateInstantaneousSpeed returns null when timestamp B is missing", () => {
  fc.assert(fc.property(
      arbitraryCoordinate,
      arbitraryCoordinate,
      fc.date({ min: new Date("2020-01-01"), max: new Date("2030-12-31") }),
      (coordA, coordB, dateA) => {
        const a = makeTrackpoint({ coordinate: coordA, timestamp: dateA.toISOString(), index: 0 });
        const b = makeTrackpoint({ coordinate: coordB, timestamp: null, index: 1 });

        const speed = calculateInstantaneousSpeed(a, b);
        expect(speed).toEqual(null);
      },
    ), { numRuns: 100 });
});

it("Property 12.4: calculateInstantaneousSpeed returns null for zero elapsed time", () => {
  fc.assert(fc.property(
      arbitraryCoordinate,
      arbitraryCoordinate,
      fc.date({ min: new Date("2020-01-01"), max: new Date("2030-12-31") }),
      (coordA, coordB, date) => {
        const timestamp = date.toISOString();
        const a = makeTrackpoint({ coordinate: coordA, timestamp, index: 0 });
        const b = makeTrackpoint({ coordinate: coordB, timestamp, index: 1 });

        const speed = calculateInstantaneousSpeed(a, b);
        expect(speed).toEqual(null);
      },
    ), { numRuns: 100 });
});

it("Property 12.5: calculateInstantaneousSpeed equals haversineDistance / elapsedHours for valid inputs", () => {
  fc.assert(fc.property(
      arbitraryCoordinate,
      arbitraryCoordinate,
      fc.integer({ min: 1, max: 7200 }),
      (coordA, coordB, offsetSeconds) => {
        const baseTime = new Date("2024-01-01T10:00:00Z");
        const a = makeTrackpoint({
          coordinate: coordA,
          timestamp: baseTime.toISOString(),
          index: 0,
        });
        const b = makeTrackpoint({
          coordinate: coordB,
          timestamp: new Date(baseTime.getTime() + offsetSeconds * 1000).toISOString(),
          index: 1,
        });

        const speed = calculateInstantaneousSpeed(a, b);
        expect(speed !== null).toBeTruthy();

        const distanceKm = haversineDistance(coordA, coordB);
        const elapsedHours = offsetSeconds / 3600;
        const expectedSpeed = distanceKm / elapsedHours;

        // Allow small floating point tolerance
        const diff = Math.abs(speed - expectedSpeed);
        expect(diff < 1e-9, `Speed ${speed} should equal distance/time ${expectedSpeed}, diff: ${diff}`).toBeTruthy();
      },
    ), { numRuns: 100 });
});

// --- Property 13: Sliding window average correctness ---
// **Validates: Requirements 12.2, 12.7**

it("Property 13.1: applySlidingWindow output has same length as input", () => {
  fc.assert(fc.property(
      fc.array(fc.option(fc.double({ min: 0, max: 50, noNaN: true }), { nil: null }), {
        minLength: 1,
        maxLength: 100,
      }),
      fc.integer({ min: 3, max: 50 }),
      (speeds, windowSize) => {
        const result = applySlidingWindow(speeds, windowSize);
        expect(result.length).toEqual(speeds.length);
      },
    ), { numRuns: 100 });
});

it("Property 13.2: applySlidingWindow non-null values are within [min(input), max(input)]", () => {
  fc.assert(fc.property(
      fc.array(fc.option(fc.double({ min: 0, max: 50, noNaN: true }), { nil: null }), {
        minLength: 1,
        maxLength: 100,
      }),
      fc.integer({ min: 3, max: 50 }),
      (speeds, windowSize) => {
        // Find the range of non-null input values
        const nonNullInputs = speeds.filter((s): s is number => s !== null);
        if (nonNullInputs.length === 0) return; // skip if all null

        const minInput = Math.min(...nonNullInputs);
        const maxInput = Math.max(...nonNullInputs);

        const result = applySlidingWindow(speeds, windowSize);

        for (const val of result) {
          if (val !== null) {
            expect(val >= minInput - 1e-10, `Windowed value ${val} should be >= min input ${minInput}`).toBeTruthy();
            expect(val <= maxInput + 1e-10, `Windowed value ${val} should be <= max input ${maxInput}`).toBeTruthy();
          }
        }
      },
    ), { numRuns: 100 });
});

it("Property 13.3: applySlidingWindow returns null only where all values in window are null", () => {
  fc.assert(fc.property(
      fc.array(fc.option(fc.double({ min: 0, max: 50, noNaN: true }), { nil: null }), {
        minLength: 1,
        maxLength: 50,
      }),
      fc.integer({ min: 3, max: 15 }),
      (speeds, windowSize) => {
        const result = applySlidingWindow(speeds, windowSize);
        const halfWindow = Math.floor(windowSize / 2);

        for (let i = 0; i < speeds.length; i++) {
          const start = Math.max(0, i - halfWindow);
          const end = Math.min(speeds.length - 1, i + halfWindow);

          // Check if there's at least one non-null value in window
          let hasNonNull = false;
          for (let j = start; j <= end; j++) {
            if (speeds[j] !== null) {
              hasNonNull = true;
              break;
            }
          }

          if (!hasNonNull) {
            expect(result[i], `Index ${i}: all-null window should produce null`).toEqual(null);
          } else {
            expect(result[i] !== null, `Index ${i}: window with non-null values should not produce null`).toBeTruthy();
          }
        }
      },
    ), { numRuns: 100 });
});

it("Property 13.4: applySlidingWindow computes correct arithmetic mean", () => {
  fc.assert(fc.property(
      fc.array(fc.option(fc.double({ min: 0, max: 50, noNaN: true }), { nil: null }), {
        minLength: 1,
        maxLength: 30,
      }),
      fc.integer({ min: 3, max: 10 }),
      (speeds, windowSize) => {
        const result = applySlidingWindow(speeds, windowSize);
        const halfWindow = Math.floor(windowSize / 2);

        for (let i = 0; i < speeds.length; i++) {
          const start = Math.max(0, i - halfWindow);
          const end = Math.min(speeds.length - 1, i + halfWindow);

          let sum = 0;
          let count = 0;
          for (let j = start; j <= end; j++) {
            if (speeds[j] !== null) {
              sum += speeds[j]!;
              count++;
            }
          }

          if (count === 0) {
            expect(result[i]).toEqual(null);
          } else {
            const expected = sum / count;
            const actual = result[i]!;
            const diff = Math.abs(actual - expected);
            expect(diff < 1e-10, `Index ${i}: expected ${expected}, got ${actual}, diff: ${diff}`).toBeTruthy();
          }
        }
      },
    ), { numRuns: 100 });
});

// --- Property 14: Speed-based segment classification follows threshold rules ---
// **Validates: Requirements 12.3, 12.4, 12.8**

it("Property 14.1: uniform low speed track (< 5 kph) produces single swim segment", () => {
  fc.assert(fc.property(
      // Generate a low speed between 1 and 4 kph
      fc.double({ min: 1, max: 4, noNaN: true }),
      // Number of trackpoints (need enough for minConsecutive=5 plus window)
      fc.integer({ min: 20, max: 50 }),
      (targetSpeedKph, numPoints) => {
        // Create a straight track where consecutive points have the target speed
        // Speed = distance / time, so for a given speed and time interval,
        // we compute the distance between consecutive points
        const timeIntervalSeconds = 10; // 10 seconds between points
        const distancePerInterval = (targetSpeedKph / 3600) * timeIntervalSeconds; // km per interval

        // Create trackpoints along a line (constant latitude, varying longitude)
        const baseLat = 45.0;
        const baseLon = 5.0;
        // Approximate: 1 degree longitude at lat 45 ≈ 78.85 km
        const degreePerKm = 1 / 78.85;

        const trackpoints: Trackpoint[] = [];
        const baseTime = new Date("2024-01-01T10:00:00Z").getTime();

        for (let i = 0; i < numPoints; i++) {
          trackpoints.push({
            coordinate: {
              lat: baseLat,
              lon: baseLon + i * distancePerInterval * degreePerKm,
            },
            elevation: 100,
            timestamp: new Date(baseTime + i * timeIntervalSeconds * 1000).toISOString(),
            index: i,
          });
        }

        const result = detectBySpeed(trackpoints);

        // Should have segments
        expect(result.segments.length > 0, "Should produce at least one segment").toBeTruthy();

        // All segments should be swim (uniform speed < 5 kph)
        for (const seg of result.segments) {
          expect(seg.type, `At speed ${targetSpeedKph} kph, all segments should be swim, got ${seg.type}`).toEqual("swim");
        }
      },
    ), { numRuns: 20 });
});

it("Property 14.2: uniform high speed track (≥ 5 kph) produces single run segment", () => {
  fc.assert(fc.property(
      // Generate a high speed between 6 and 15 kph
      fc.double({ min: 6, max: 15, noNaN: true }),
      // Number of trackpoints
      fc.integer({ min: 20, max: 50 }),
      (targetSpeedKph, numPoints) => {
        const timeIntervalSeconds = 10;
        const distancePerInterval = (targetSpeedKph / 3600) * timeIntervalSeconds;

        const baseLat = 45.0;
        const baseLon = 5.0;
        const degreePerKm = 1 / 78.85;

        const trackpoints: Trackpoint[] = [];
        const baseTime = new Date("2024-01-01T10:00:00Z").getTime();

        for (let i = 0; i < numPoints; i++) {
          trackpoints.push({
            coordinate: {
              lat: baseLat,
              lon: baseLon + i * distancePerInterval * degreePerKm,
            },
            elevation: 100,
            timestamp: new Date(baseTime + i * timeIntervalSeconds * 1000).toISOString(),
            index: i,
          });
        }

        const result = detectBySpeed(trackpoints);

        expect(result.segments.length > 0, "Should produce at least one segment").toBeTruthy();

        // All segments should be run (uniform speed >= 5 kph)
        for (const seg of result.segments) {
          expect(seg.type, `At speed ${targetSpeedKph} kph, all segments should be run, got ${seg.type}`).toEqual("run");
        }
      },
    ), { numRuns: 20 });
});

// --- Property 15: Speed transition confidence formula ---
// **Validates: Requirements 12.5**

it("Property 15.1: calculateSpeedConfidence always returns value in [0, 1]", () => {
  fc.assert(fc.property(
      fc.double({ min: -100, max: 100, noNaN: true }),
      fc.double({ min: -100, max: 100, noNaN: true }),
      (meanBefore, meanAfter) => {
        const confidence = calculateSpeedConfidence(meanBefore, meanAfter);
        expect(confidence >= 0, `Confidence ${confidence} should be >= 0`).toBeTruthy();
        expect(confidence <= 1, `Confidence ${confidence} should be <= 1`).toBeTruthy();
      },
    ), { numRuns: 200 });
});

it("Property 15.2: calculateSpeedConfidence is symmetric", () => {
  fc.assert(fc.property(
      fc.double({ min: -100, max: 100, noNaN: true }),
      fc.double({ min: -100, max: 100, noNaN: true }),
      (a, b) => {
        const conf1 = calculateSpeedConfidence(a, b);
        const conf2 = calculateSpeedConfidence(b, a);
        const diff = Math.abs(conf1 - conf2);
        expect(diff < 1e-10, `Confidence should be symmetric: f(${a},${b})=${conf1} vs f(${b},${a})=${conf2}`).toBeTruthy();
      },
    ), { numRuns: 200 });
});

it("Property 15.3: calculateSpeedConfidence equals 0 for equal inputs", () => {
  fc.assert(fc.property(
      fc.double({ min: -100, max: 100, noNaN: true }),
      (value) => {
        const confidence = calculateSpeedConfidence(value, value);
        expect(confidence, `Confidence should be 0 for equal inputs (${value}, ${value})`).toEqual(0);
      },
    ), { numRuns: 200 });
});

it("Property 15.4: calculateSpeedConfidence equals min(1.0, |a - b| / 10)", () => {
  fc.assert(fc.property(
      fc.double({ min: -100, max: 100, noNaN: true }),
      fc.double({ min: -100, max: 100, noNaN: true }),
      (a, b) => {
        const confidence = calculateSpeedConfidence(a, b);
        const expected = Math.min(1.0, Math.abs(a - b) / 10);
        const diff = Math.abs(confidence - expected);
        expect(diff < 1e-10, `Confidence ${confidence} should equal min(1, |${a} - ${b}| / 10) = ${expected}`).toBeTruthy();
      },
    ), { numRuns: 200 });
});
