import { expect, it } from "vitest";
import {
  applySlidingWindow,
  calculateInstantaneousSpeed,
  calculateSpeedConfidence,
  detectBySpeed,
  isSpeedDetectionAvailable,
} from "./speed-analyzer.ts";
import type { Trackpoint } from "../shared/types.ts";

// --- Helpers ---

function makeTrackpoint(
  index: number,
  lat: number,
  lon: number,
  timestamp: string | null = null,
): Trackpoint {
  return {
    coordinate: { lat, lon },
    elevation: 100,
    timestamp,
    index,
  };
}

/**
 * Create a series of trackpoints with timestamps simulating a given speed in kph.
 * Points are placed along a straight line with timestamps matching the desired speed.
 */
function makeTrackAtSpeed(
  startIndex: number,
  count: number,
  speedKph: number,
  startLat = 45.0,
  startLon = 5.0,
  startTime = "2024-01-01T10:00:00Z",
): Trackpoint[] {
  const trackpoints: Trackpoint[] = [];
  const startMs = new Date(startTime).getTime();
  // Place points ~100m apart (0.001 degree lat ≈ 111m)
  const stepDeg = 0.001;
  const distanceKm = stepDeg * 111.32; // approx km per step
  const timePerStepHours = distanceKm / speedKph;
  const timePerStepMs = timePerStepHours * 3600 * 1000;

  for (let i = 0; i < count; i++) {
    const lat = startLat + i * stepDeg;
    const time = new Date(startMs + i * timePerStepMs).toISOString();
    trackpoints.push(makeTrackpoint(startIndex + i, lat, startLon, time));
  }
  return trackpoints;
}

// --- calculateInstantaneousSpeed ---

it("calculateInstantaneousSpeed - returns speed in kph for valid trackpoints", () => {
  // Two points ~111m apart with 10 second gap → ~40 kph
  const a = makeTrackpoint(0, 45.0, 5.0, "2024-01-01T10:00:00Z");
  const b = makeTrackpoint(1, 45.001, 5.0, "2024-01-01T10:00:10Z");
  const speed = calculateInstantaneousSpeed(a, b);
  // 0.001 deg lat ≈ 111m, in 10 seconds → ~40 kph
  expect(speed !== null).toEqual(true);
  expect(Math.abs((speed!) - (40))).toBeLessThanOrEqual(2); // within 2 kph
});

it("calculateInstantaneousSpeed - returns null when first timestamp is null", () => {
  const a = makeTrackpoint(0, 45.0, 5.0, null);
  const b = makeTrackpoint(1, 45.001, 5.0, "2024-01-01T10:00:10Z");
  expect(calculateInstantaneousSpeed(a, b)).toEqual(null);
});

it("calculateInstantaneousSpeed - returns null when second timestamp is null", () => {
  const a = makeTrackpoint(0, 45.0, 5.0, "2024-01-01T10:00:00Z");
  const b = makeTrackpoint(1, 45.001, 5.0, null);
  expect(calculateInstantaneousSpeed(a, b)).toEqual(null);
});

it("calculateInstantaneousSpeed - returns null for zero elapsed time", () => {
  const a = makeTrackpoint(0, 45.0, 5.0, "2024-01-01T10:00:00Z");
  const b = makeTrackpoint(1, 45.001, 5.0, "2024-01-01T10:00:00Z");
  expect(calculateInstantaneousSpeed(a, b)).toEqual(null);
});

it("calculateInstantaneousSpeed - stationary points yield ~0 speed", () => {
  const a = makeTrackpoint(0, 45.0, 5.0, "2024-01-01T10:00:00Z");
  const b = makeTrackpoint(1, 45.0, 5.0, "2024-01-01T10:00:10Z");
  const speed = calculateInstantaneousSpeed(a, b);
  expect(speed).toEqual(0);
});

// --- applySlidingWindow ---

it("applySlidingWindow - averages values within window (centered)", () => {
  const speeds = [10, 12, 8, 11, 9];
  const result = applySlidingWindow(speeds as (number | null)[], 3);
  // Centered window of size 3:
  // Index 0: window [0..1] → avg(10,12) = 11 (can't look back past start)
  expect(Math.abs((result[0]!) - (11))).toBeLessThanOrEqual(0.01);
  // Index 1: window [0..2] → avg(10,12,8) = 10
  expect(Math.abs((result[1]!) - (10))).toBeLessThanOrEqual(0.01);
  // Index 2: window [1..3] → avg(12,8,11) = 10.33
  expect(Math.abs((result[2]!) - (10.33))).toBeLessThanOrEqual(0.01);
});

it("applySlidingWindow - skips null values in the window", () => {
  const speeds: (number | null)[] = [10, null, 8, null, 12];
  const result = applySlidingWindow(speeds, 3);
  // Centered window of size 3:
  // Index 0: window [0..1] → non-null: [10] → avg = 10
  expect(Math.abs((result[0]!) - (10))).toBeLessThanOrEqual(0.01);
  // Index 2: window [1..3] → non-null: [8] → avg = 8
  expect(Math.abs((result[2]!) - (8))).toBeLessThanOrEqual(0.01);
});

it("applySlidingWindow - returns null when all values in window are null", () => {
  const speeds: (number | null)[] = [null, null, null, 10, 12];
  const result = applySlidingWindow(speeds, 3);
  expect(result[0]).toEqual(null);
});

it("applySlidingWindow - window size 1 returns input values", () => {
  const speeds: (number | null)[] = [5, 10, 15];
  const result = applySlidingWindow(speeds, 1);
  expect(result[0]).toEqual(5);
  expect(result[1]).toEqual(10);
  expect(result[2]).toEqual(15);
});

it("applySlidingWindow - output has same length as input", () => {
  const speeds: (number | null)[] = [1, 2, 3, 4, 5, 6, 7];
  const result = applySlidingWindow(speeds, 4);
  expect(result.length).toEqual(speeds.length);
});

// --- calculateSpeedConfidence ---

it("calculateSpeedConfidence - large difference yields high confidence", () => {
  // |3 - 10| / 10 = 0.7
  expect(Math.abs((calculateSpeedConfidence(3, 10)) - (0.7))).toBeLessThanOrEqual(0.01);
});

it("calculateSpeedConfidence - capped at 1.0", () => {
  // |2 - 15| / 10 = 1.3 → capped at 1.0
  expect(calculateSpeedConfidence(2, 15)).toEqual(1.0);
});

it("calculateSpeedConfidence - same speed yields 0", () => {
  expect(calculateSpeedConfidence(7, 7)).toEqual(0);
});

it("calculateSpeedConfidence - symmetric", () => {
  expect(calculateSpeedConfidence(3, 8)).toEqual(calculateSpeedConfidence(8, 3));
});

// --- isSpeedDetectionAvailable ---

it("isSpeedDetectionAvailable - true with 2+ consecutive timestamped trackpoints", () => {
  const trackpoints = [
    makeTrackpoint(0, 45.0, 5.0, "2024-01-01T10:00:00Z"),
    makeTrackpoint(1, 45.001, 5.0, "2024-01-01T10:00:10Z"),
  ];
  expect(isSpeedDetectionAvailable(trackpoints)).toEqual(true);
});

it("isSpeedDetectionAvailable - false with only 1 timestamped trackpoint", () => {
  const trackpoints = [
    makeTrackpoint(0, 45.0, 5.0, "2024-01-01T10:00:00Z"),
    makeTrackpoint(1, 45.001, 5.0, null),
  ];
  expect(isSpeedDetectionAvailable(trackpoints)).toEqual(false);
});

it("isSpeedDetectionAvailable - false with no timestamps", () => {
  const trackpoints = [
    makeTrackpoint(0, 45.0, 5.0, null),
    makeTrackpoint(1, 45.001, 5.0, null),
  ];
  expect(isSpeedDetectionAvailable(trackpoints)).toEqual(false);
});

it("isSpeedDetectionAvailable - true with non-consecutive timestamps if 2 are consecutive", () => {
  const trackpoints = [
    makeTrackpoint(0, 45.0, 5.0, null),
    makeTrackpoint(1, 45.001, 5.0, "2024-01-01T10:00:00Z"),
    makeTrackpoint(2, 45.002, 5.0, "2024-01-01T10:00:10Z"),
  ];
  expect(isSpeedDetectionAvailable(trackpoints)).toEqual(true);
});

it("isSpeedDetectionAvailable - empty array → false", () => {
  expect(isSpeedDetectionAvailable([])).toEqual(false);
});

// --- detectBySpeed ---

it("detectBySpeed - returns strategy 'speed'", () => {
  const trackpoints = makeTrackAtSpeed(0, 20, 8); // all running
  const result = detectBySpeed(trackpoints);
  expect(result.strategy).toEqual("speed");
});

it("detectBySpeed - uniform running speed → single run segment", () => {
  const trackpoints = makeTrackAtSpeed(0, 20, 8); // 8 kph = running
  const result = detectBySpeed(trackpoints);
  expect(result.segments.length).toEqual(1);
  expect(result.segments[0].type).toEqual("run");
  expect(result.segments[0].startTrackpointIndex).toEqual(0);
  expect(result.segments[0].endTrackpointIndex).toEqual(19);
});

it("detectBySpeed - uniform swimming speed → single swim segment", () => {
  const trackpoints = makeTrackAtSpeed(0, 20, 3); // 3 kph = swimming
  const result = detectBySpeed(trackpoints);
  expect(result.segments.length).toEqual(1);
  expect(result.segments[0].type).toEqual("swim");
  expect(result.segments[0].startTrackpointIndex).toEqual(0);
  expect(result.segments[0].endTrackpointIndex).toEqual(19);
});

it("detectBySpeed - run then swim produces two segments", () => {
  const runPoints = makeTrackAtSpeed(0, 15, 8, 45.0, 5.0, "2024-01-01T10:00:00Z");
  const lastRunTime = runPoints[runPoints.length - 1].timestamp!;
  const swimPoints = makeTrackAtSpeed(
    15,
    15,
    3,
    runPoints[runPoints.length - 1].coordinate.lat + 0.001,
    5.0,
    lastRunTime,
  );
  const trackpoints = [...runPoints, ...swimPoints];
  const result = detectBySpeed(trackpoints, { windowSize: 3, minConsecutive: 3 });
  expect(result.segments.length >= 2).toEqual(true);
  // First segment should be run, last should be swim
  expect(result.segments[0].type).toEqual("run");
  expect(result.segments[result.segments.length - 1].type).toEqual("swim");
});

it("detectBySpeed - respects custom config", () => {
  // With a very high swim threshold, everything is swim
  const trackpoints = makeTrackAtSpeed(0, 20, 8);
  const result = detectBySpeed(trackpoints, {
    swimThresholdKph: 20, // 20 kph threshold means 8 kph is "swim"
    windowSize: 3,
    minConsecutive: 3,
  });
  expect(result.segments.length).toEqual(1);
  expect(result.segments[0].type).toEqual("swim");
});

it("detectBySpeed - windowSize clamped to min 3", () => {
  const trackpoints = makeTrackAtSpeed(0, 20, 8);
  // Should not throw with windowSize: 1, should clamp to 3
  const result = detectBySpeed(trackpoints, { windowSize: 1 });
  expect(result.strategy).toEqual("speed");
  expect(result.segments.length >= 1).toEqual(true);
});

it("detectBySpeed - windowSize clamped to max 50", () => {
  const trackpoints = makeTrackAtSpeed(0, 60, 8);
  // Should not throw with windowSize: 100, should clamp to 50
  const result = detectBySpeed(trackpoints, { windowSize: 100 });
  expect(result.strategy).toEqual("speed");
  expect(result.segments.length >= 1).toEqual(true);
});

it("detectBySpeed - empty trackpoints → empty segments", () => {
  const result = detectBySpeed([]);
  expect(result.strategy).toEqual("speed");
  expect(result.segments.length).toEqual(0);
});

it("detectBySpeed - single trackpoint → empty segments", () => {
  const result = detectBySpeed([makeTrackpoint(0, 45.0, 5.0, "2024-01-01T10:00:00Z")]);
  expect(result.strategy).toEqual("speed");
  expect(result.segments.length).toEqual(0);
});

it("detectBySpeed - segments cover full trackpoint range", () => {
  const trackpoints = makeTrackAtSpeed(0, 30, 8);
  const result = detectBySpeed(trackpoints);
  if (result.segments.length > 0) {
    expect(result.segments[0].startTrackpointIndex).toEqual(0);
    expect(result.segments[result.segments.length - 1].endTrackpointIndex).toEqual(29);
  }
});

it("detectBySpeed - confidence score between 0 and 1", () => {
  const runPoints = makeTrackAtSpeed(0, 15, 8, 45.0, 5.0, "2024-01-01T10:00:00Z");
  const lastRunTime = runPoints[runPoints.length - 1].timestamp!;
  const swimPoints = makeTrackAtSpeed(
    15,
    15,
    3,
    runPoints[runPoints.length - 1].coordinate.lat + 0.001,
    5.0,
    lastRunTime,
  );
  const trackpoints = [...runPoints, ...swimPoints];
  const result = detectBySpeed(trackpoints, { windowSize: 3, minConsecutive: 3 });
  for (const seg of result.segments) {
    expect(seg.confidenceScore >= 0 && seg.confidenceScore <= 1.0).toEqual(true);
  }
});

it("detectBySpeed - no timestamps → empty segments", () => {
  const trackpoints = [
    makeTrackpoint(0, 45.0, 5.0, null),
    makeTrackpoint(1, 45.001, 5.0, null),
    makeTrackpoint(2, 45.002, 5.0, null),
  ];
  const result = detectBySpeed(trackpoints);
  expect(result.segments.length).toEqual(0);
});
