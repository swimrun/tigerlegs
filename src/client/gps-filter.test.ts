import { expect, it } from "vitest";
import {
  computeScatterRatio,
  detectLateralDeviation,
  filterSwimSegment,
  smoothPath,
} from "./gps-filter.ts";
import { haversineDistance } from "../shared/distance-calculator.ts";
import type { Trackpoint } from "../shared/types.ts";

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
 * Create a straight line of trackpoints from start to end.
 */
function makeStraightLine(
  startIndex: number,
  count: number,
  startLat: number,
  startLon: number,
  endLat: number,
  endLon: number,
): Trackpoint[] {
  const trackpoints: Trackpoint[] = [];
  for (let i = 0; i < count; i++) {
    const t = count > 1 ? i / (count - 1) : 0;
    const lat = startLat + t * (endLat - startLat);
    const lon = startLon + t * (endLon - startLon);
    trackpoints.push(makeTrackpoint(startIndex + i, lat, lon));
  }
  return trackpoints;
}

/**
 * Create trackpoints with noise (lateral deviation) from a straight line.
 * deviationDeg is the lateral offset in degrees applied perpendicularly.
 */
function makeNoisyLine(
  startIndex: number,
  count: number,
  startLat: number,
  startLon: number,
  endLat: number,
  endLon: number,
  deviationDeg: number,
): Trackpoint[] {
  const trackpoints: Trackpoint[] = [];
  for (let i = 0; i < count; i++) {
    const t = count > 1 ? i / (count - 1) : 0;
    const lat = startLat + t * (endLat - startLat);
    const lon = startLon + t * (endLon - startLon);
    // Apply alternating perpendicular noise (except start and end)
    if (i === 0 || i === count - 1) {
      trackpoints.push(makeTrackpoint(startIndex + i, lat, lon));
    } else {
      const sign = i % 2 === 0 ? 1 : -1;
      // For a primarily north-south line, deviate in longitude
      trackpoints.push(
        makeTrackpoint(startIndex + i, lat, lon + sign * deviationDeg),
      );
    }
  }
  return trackpoints;
}

// --- computeScatterRatio ---

it("computeScatterRatio - straight line returns ~1.0", () => {
  const trackpoints = makeStraightLine(0, 10, 45.0, 5.0, 45.01, 5.0);
  const ratio = computeScatterRatio(trackpoints, 0, 9);
  expect(Math.abs((ratio) - (1.0))).toBeLessThanOrEqual(0.01);
});

it("computeScatterRatio - noisy path returns ratio > 1.0", () => {
  // Create a path with significant zigzag
  const trackpoints = makeNoisyLine(0, 10, 45.0, 5.0, 45.01, 5.0, 0.002);
  const ratio = computeScatterRatio(trackpoints, 0, 9);
  expect(ratio > 1.0).toEqual(true);
});

it("computeScatterRatio - two identical points returns Infinity", () => {
  const trackpoints = [
    makeTrackpoint(0, 45.0, 5.0),
    makeTrackpoint(1, 45.0, 5.0),
  ];
  const ratio = computeScatterRatio(trackpoints, 0, 1);
  expect(ratio).toEqual(Infinity);
});

it("computeScatterRatio - single point returns Infinity", () => {
  const trackpoints = [makeTrackpoint(0, 45.0, 5.0)];
  const ratio = computeScatterRatio(trackpoints, 0, 0);
  // straight-line is 0, cumulative is 0, so 0/0 → treat as Infinity
  expect(ratio).toEqual(Infinity);
});

it("computeScatterRatio - uses startIndex and endIndex correctly", () => {
  const trackpoints = [
    makeTrackpoint(0, 45.0, 5.0),
    makeTrackpoint(1, 45.005, 5.0), // straight part
    makeTrackpoint(2, 45.01, 5.0),
    makeTrackpoint(3, 45.015, 5.01), // deviated point - not in range
    makeTrackpoint(4, 45.02, 5.0),
  ];
  // Only check middle segment (indices 0 to 2 which is straight)
  const ratio = computeScatterRatio(trackpoints, 0, 2);
  expect(Math.abs((ratio) - (1.0))).toBeLessThanOrEqual(0.01);
});

// --- detectLateralDeviation ---

it("detectLateralDeviation - straight line has no deviations", () => {
  const trackpoints = makeStraightLine(0, 10, 45.0, 5.0, 45.01, 5.0);
  const result = detectLateralDeviation(trackpoints, 0, 9, 20);
  expect(result.hasConsecutiveDeviation).toEqual(false);
  expect(result.maxConsecutive).toEqual(0);
});

it("detectLateralDeviation - points deviating same direction are counted", () => {
  // Create points that all deviate to the east (same lateral direction)
  // 0.001 degree of longitude at lat 45 ≈ 78m - well above 20m threshold
  const trackpoints: Trackpoint[] = [];
  for (let i = 0; i < 10; i++) {
    const t = i / 9;
    const lat = 45.0 + t * 0.01;
    // All intermediate points deviate east
    const lonOffset = (i > 0 && i < 9) ? 0.001 : 0;
    trackpoints.push(makeTrackpoint(i, lat, 5.0 + lonOffset));
  }
  const result = detectLateralDeviation(trackpoints, 0, 9, 20);
  expect(result.hasConsecutiveDeviation).toEqual(true);
  expect(result.maxConsecutive >= 4).toEqual(true);
});

it("detectLateralDeviation - alternating direction resets count", () => {
  // Points zigzag left-right alternately, so no consecutive same-direction
  const trackpoints: Trackpoint[] = [];
  for (let i = 0; i < 10; i++) {
    const t = i / 9;
    const lat = 45.0 + t * 0.01;
    // Alternate east/west deviation of ~78m each
    const sign = i % 2 === 0 ? 1 : -1;
    const lonOffset = (i > 0 && i < 9) ? sign * 0.001 : 0;
    trackpoints.push(makeTrackpoint(i, lat, 5.0 + lonOffset));
  }
  const result = detectLateralDeviation(trackpoints, 0, 9, 20);
  // Each direction only has 1 consecutive (alternating), never 4
  expect(result.maxConsecutive < 4).toEqual(true);
});

it("detectLateralDeviation - respects threshold parameter", () => {
  // Points deviate ~78m (0.001 deg lon at lat 45)
  const trackpoints: Trackpoint[] = [];
  for (let i = 0; i < 10; i++) {
    const t = i / 9;
    const lat = 45.0 + t * 0.01;
    const lonOffset = (i > 0 && i < 9) ? 0.001 : 0;
    trackpoints.push(makeTrackpoint(i, lat, 5.0 + lonOffset));
  }
  // With threshold 100m, 78m deviation is below threshold → no deviations
  const result = detectLateralDeviation(trackpoints, 0, 9, 100);
  expect(result.maxConsecutive).toEqual(0);
});

// --- smoothPath ---

it("smoothPath - with window 1 returns original coordinates", () => {
  const trackpoints = makeStraightLine(0, 5, 45.0, 5.0, 45.004, 5.0);
  const result = smoothPath(trackpoints, 1);
  expect(result.length).toEqual(5);
  for (let i = 0; i < 5; i++) {
    expect(Math.abs((result[i].lat) - (trackpoints[i].coordinate.lat))).toBeLessThanOrEqual(0.0001);
    expect(Math.abs((result[i].lon) - (trackpoints[i].coordinate.lon))).toBeLessThanOrEqual(0.0001);
  }
});

it("smoothPath - averages coordinates within window", () => {
  const trackpoints = [
    makeTrackpoint(0, 45.0, 5.0),
    makeTrackpoint(1, 45.002, 5.0),
    makeTrackpoint(2, 45.001, 5.0), // this should be averaged with neighbors
    makeTrackpoint(3, 45.003, 5.0),
    makeTrackpoint(4, 45.004, 5.0),
  ];
  const result = smoothPath(trackpoints, 3);
  expect(result.length).toEqual(5);
  // Middle point (index 2) should be average of indices 1, 2, 3
  const expectedLat = (45.002 + 45.001 + 45.003) / 3;
  expect(Math.abs((result[2].lat) - (expectedLat))).toBeLessThanOrEqual(0.0001);
});

it("smoothPath - output length matches input length", () => {
  const trackpoints = makeStraightLine(0, 7, 45.0, 5.0, 45.007, 5.0);
  const result = smoothPath(trackpoints, 5);
  expect(result.length).toEqual(7);
});

it("smoothPath - does not mutate input", () => {
  const trackpoints = makeStraightLine(0, 5, 45.0, 5.0, 45.004, 5.0);
  const originalLats = trackpoints.map((tp) => tp.coordinate.lat);
  smoothPath(trackpoints, 3);
  for (let i = 0; i < trackpoints.length; i++) {
    expect(trackpoints[i].coordinate.lat).toEqual(originalLats[i]);
  }
});

// --- filterSwimSegment ---

it("filterSwimSegment - straight line returns no filtering", () => {
  // ~1.1 km straight line
  const trackpoints = makeStraightLine(0, 10, 45.0, 5.0, 45.01, 5.0);
  const result = filterSwimSegment(trackpoints, 0, 9);
  expect(result.hasSignificantNoise).toEqual(false);
  expect(result.filterMethod).toEqual("none");
  expect(Math.abs((result.scatterRatio) - (1.0))).toBeLessThanOrEqual(0.05);
});

it("filterSwimSegment - very short segment skips filtering", () => {
  // Points ~1m apart (0.00001 deg lat ≈ 1.1m)
  const trackpoints = makeStraightLine(0, 3, 45.0, 5.0, 45.00003, 5.0);
  const result = filterSwimSegment(trackpoints, 0, 2);
  expect(result.filterMethod).toEqual("none");
  // Distance should be the cumulative distance
  expect(result.filteredDistance > 0).toEqual(true);
});

it("filterSwimSegment - noisy segment with few consecutive deviations uses straight-line", () => {
  // Create a ~1km path with scattered noise (alternating zigzag)
  // Alternating means no consecutive same-direction deviations
  const trackpoints: Trackpoint[] = [];
  const count = 20;
  for (let i = 0; i < count; i++) {
    const t = i / (count - 1);
    const lat = 45.0 + t * 0.01; // ~1.1km north
    // Alternating large noise to make scatter ratio > 1.5
    const sign = i % 2 === 0 ? 1 : -1;
    const lonOffset = (i > 0 && i < count - 1) ? sign * 0.003 : 0; // ~235m deviation
    trackpoints.push(makeTrackpoint(i, lat, 5.0 + lonOffset));
  }
  const result = filterSwimSegment(trackpoints, 0, count - 1);
  expect(result.hasSignificantNoise).toEqual(true);
  expect(result.filterMethod).toEqual("straight-line");
});

it("filterSwimSegment - noisy segment with many consecutive deviations uses smoothing", () => {
  // Create a path where points deviate significantly to one side AND creates
  // enough zigzag to inflate the scatter ratio above 1.5.
  // Strategy: some points go way to one side, some zigzag back slightly,
  // but overall have 4+ consecutive same-direction deviations.
  const trackpoints: Trackpoint[] = [];
  const count = 20;
  for (let i = 0; i < count; i++) {
    const t = i / (count - 1);
    const lat = 45.0 + t * 0.01; // ~1.1km north
    let lonOffset = 0;
    if (i > 0 && i < count - 1) {
      // Create a zigzag pattern that still has 4+ consecutive on one side
      // Odd indices go far east, even indices go slightly east
      // This creates large cumulative distance while all being on same side
      if (i % 2 === 1) {
        lonOffset = 0.005; // ~390m east - way above 20m threshold
      } else {
        lonOffset = 0.001; // ~78m east - still above 20m threshold, same direction
      }
    }
    trackpoints.push(makeTrackpoint(i, lat, 5.0 + lonOffset));
  }
  const result = filterSwimSegment(trackpoints, 0, count - 1);
  expect(result.hasSignificantNoise).toEqual(true);
  expect(result.filterMethod).toEqual("smoothed");
  // Smoothed distance should be ≤ original distance
  expect(result.filteredDistance <= result.originalDistance).toEqual(true);
});

it("filterSwimSegment - never mutates input array", () => {
  const trackpoints = makeNoisyLine(0, 15, 45.0, 5.0, 45.01, 5.0, 0.003);
  const originalCoords = trackpoints.map((tp) => ({
    lat: tp.coordinate.lat,
    lon: tp.coordinate.lon,
  }));
  filterSwimSegment(trackpoints, 0, 14);
  for (let i = 0; i < trackpoints.length; i++) {
    expect(trackpoints[i].coordinate.lat).toEqual(originalCoords[i].lat);
    expect(trackpoints[i].coordinate.lon).toEqual(originalCoords[i].lon);
  }
});

it("filterSwimSegment - result includes original distance", () => {
  const trackpoints = makeStraightLine(0, 10, 45.0, 5.0, 45.01, 5.0);
  const result = filterSwimSegment(trackpoints, 0, 9);
  expect(result.originalDistance > 0).toEqual(true);
});

it("filterSwimSegment - respects custom config", () => {
  // With scatterThreshold: 10 (very high), nothing should be classified as noisy
  const trackpoints = makeNoisyLine(0, 15, 45.0, 5.0, 45.01, 5.0, 0.003);
  const result = filterSwimSegment(trackpoints, 0, 14, {
    scatterThreshold: 10,
  });
  expect(result.hasSignificantNoise).toEqual(false);
  expect(result.filterMethod).toEqual("none");
});

it("filterSwimSegment - smoothed distance capped at maxSmoothedRatio of straight-line", () => {
  // Create a heavily noisy path with consecutive same-direction deviations
  const trackpoints: Trackpoint[] = [];
  const count = 30;
  for (let i = 0; i < count; i++) {
    const t = i / (count - 1);
    const lat = 45.0 + t * 0.01; // ~1.1km
    // All deviate to the same side → consecutive ≥ 4
    const lonOffset = (i > 0 && i < count - 1) ? 0.005 : 0; // large deviation
    trackpoints.push(makeTrackpoint(i, lat, 5.0 + lonOffset));
  }
  const result = filterSwimSegment(trackpoints, 0, count - 1, {
    maxSmoothedRatio: 1.2,
  });
  if (result.filterMethod === "smoothed") {
    // Compute straight-line distance and verify cap
    // The filtered distance should be ≤ 1.2 * straight-line
    const straightLine = haversineDistance(
      trackpoints[0].coordinate,
      trackpoints[count - 1].coordinate,
    );
    expect(result.filteredDistance <= straightLine * 1.2 + 0.001).toEqual(true);
  }
});
