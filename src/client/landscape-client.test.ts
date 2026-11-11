import { BACKEND_ORIGIN } from "../server/config.ts";
import { expect, it } from "vitest";
import {
  calculateLandscapeConfidence,
  detectByLandscape,
  sampleCoordinates,
  queryTerrain,
} from "./landscape-client.ts";
import type {
  Coordinate,
  TerrainResult,
  Trackpoint,
} from "../shared/types.ts";
import type { LandscapeClientConfig } from "./landscape-client.ts";

// --- Helpers ---

function makeTrackpoint(
  index: number,
  lat: number,
  lon: number,
): Trackpoint {
  return {
    coordinate: { lat, lon },
    elevation: 100,
    timestamp: null,
    index,
  };
}

/**
 * Create trackpoints along a straight line with specified spacing in degrees.
 * ~0.00045 degrees lat ≈ 50m
 */
function makeTrackLine(
  count: number,
  startLat = 45.0,
  startLon = 5.0,
  stepDeg = 0.00045,
): Trackpoint[] {
  const trackpoints: Trackpoint[] = [];
  for (let i = 0; i < count; i++) {
    trackpoints.push(makeTrackpoint(i, startLat + i * stepDeg, startLon));
  }
  return trackpoints;
}

function makeTerrainResult(
  lat: number,
  lon: number,
  terrainType: "water" | "land" | "unknown",
  hasRoadData = false,
): TerrainResult {
  return {
    coordinate: { lat, lon },
    terrainType,
    hasRoadData,
  };
}

// --- sampleCoordinates ---

it("sampleCoordinates - always includes first and last trackpoint", () => {
  const trackpoints = makeTrackLine(10, 45.0, 5.0, 0.001); // ~111m apart
  const samples = sampleCoordinates(trackpoints, 50);
  expect(samples[0].lat).toEqual(trackpoints[0].coordinate.lat);
  expect(samples[0].lon).toEqual(trackpoints[0].coordinate.lon);
  expect(samples[samples.length - 1].lat).toEqual(trackpoints[trackpoints.length - 1].coordinate.lat);
  expect(samples[samples.length - 1].lon).toEqual(trackpoints[trackpoints.length - 1].coordinate.lon);
});

it("sampleCoordinates - samples at intervals ≤ intervalMetres", () => {
  // Points ~111m apart, sample every 50m → should get at least 2 samples per segment
  const trackpoints = makeTrackLine(10, 45.0, 5.0, 0.001);
  const samples = sampleCoordinates(trackpoints, 50);
  // With 9 segments of ~111m each, total ~1000m, at 50m intervals ≈ 20 samples
  expect(samples.length >= 10).toEqual(true);
});

it("sampleCoordinates - single trackpoint returns that trackpoint", () => {
  const trackpoints = [makeTrackpoint(0, 45.0, 5.0)];
  const samples = sampleCoordinates(trackpoints, 50);
  expect(samples.length).toEqual(1);
  expect(samples[0].lat).toEqual(45.0);
  expect(samples[0].lon).toEqual(5.0);
});

it("sampleCoordinates - two trackpoints always returns both", () => {
  const trackpoints = [
    makeTrackpoint(0, 45.0, 5.0),
    makeTrackpoint(1, 45.001, 5.0), // ~111m apart
  ];
  const samples = sampleCoordinates(trackpoints, 50);
  expect(samples.length >= 2).toEqual(true);
  expect(samples[0].lat).toEqual(45.0);
  expect(samples[samples.length - 1].lat).toEqual(45.001);
});

it("sampleCoordinates - empty trackpoints returns empty array", () => {
  const samples = sampleCoordinates([], 50);
  expect(samples.length).toEqual(0);
});

it("sampleCoordinates - closely spaced points (< interval) still include first and last", () => {
  // Points 10m apart, interval 50m → should skip many intermediate points
  const trackpoints = makeTrackLine(20, 45.0, 5.0, 0.00009); // ~10m apart
  const samples = sampleCoordinates(trackpoints, 50);
  expect(samples[0].lat).toEqual(trackpoints[0].coordinate.lat);
  expect(samples[samples.length - 1].lat).toEqual(trackpoints[trackpoints.length - 1].coordinate.lat);
  // 20 points × 10m = ~190m total; at 50m intervals → expect about 4-5 samples
  expect(samples.length >= 3).toEqual(true);
  expect(samples.length <= 10).toEqual(true);
});

// --- queryTerrain ---

it("queryTerrain - batches requests (max batchSize per request)", async () => {
  const coordinates: Coordinate[] = Array.from({ length: 250 }, (_, i) => ({
    lat: 45.0 + i * 0.0001,
    lon: 5.0,
  }));

  let requestCount = 0;
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (input: string | URL | Request, _init?: RequestInit) => {
    requestCount++;
    const batchResponse: TerrainResult[] = [];
    // Parse the request body to know how many coords were sent
    const req = input instanceof Request ? input : new Request(input, _init);
    const body = await req.json();
    for (const coord of body.coordinates) {
      batchResponse.push({
        coordinate: coord,
        terrainType: "land",
        hasRoadData: false,
      });
    }
    return new Response(JSON.stringify(batchResponse), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  };

  try {
    const config: LandscapeClientConfig = {
      apiBaseUrl: BACKEND_ORIGIN,
      sampleIntervalMetres: 50,
      batchSize: 100,
      timeoutMs: 10000,
    };
    const result = await queryTerrain(coordinates, config);
    expect(result.ok).toEqual(true);
    if (result.ok) {
      expect(result.value.length).toEqual(250);
    }
    // 250 coords / 100 batch size = 3 requests
    expect(requestCount).toEqual(3);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

it("queryTerrain - returns error on fetch failure", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (_input: string | URL | Request, _init?: RequestInit) => {
    throw new Error("Network failure");
  };

  try {
    const config: LandscapeClientConfig = {
      apiBaseUrl: BACKEND_ORIGIN,
      sampleIntervalMetres: 50,
      batchSize: 100,
      timeoutMs: 10000,
    };
    const coordinates: Coordinate[] = [{ lat: 45.0, lon: 5.0 }];
    const result = await queryTerrain(coordinates, config);
    expect(result.ok).toEqual(false);
    if (!result.ok) {
      expect(result.error.includes("Network failure") || result.error.length > 0).toEqual(true);
    }
  } finally {
    globalThis.fetch = originalFetch;
  }
});

it("queryTerrain - returns error on non-200 response", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (_input: string | URL | Request, _init?: RequestInit) => {
    return new Response(JSON.stringify({ error: "Server error", code: "INTERNAL_ERROR" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  };

  try {
    const config: LandscapeClientConfig = {
      apiBaseUrl: BACKEND_ORIGIN,
      sampleIntervalMetres: 50,
      batchSize: 100,
      timeoutMs: 10000,
    };
    const coordinates: Coordinate[] = [{ lat: 45.0, lon: 5.0 }];
    const result = await queryTerrain(coordinates, config);
    expect(result.ok).toEqual(false);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

it("queryTerrain - empty coordinates returns empty results", async () => {
  const originalFetch = globalThis.fetch;
  // Should not even call fetch for empty input
  let fetchCalled = false;
  globalThis.fetch = async (_input: string | URL | Request, _init?: RequestInit) => {
    fetchCalled = true;
    return new Response("[]", { status: 200 });
  };

  try {
    const config: LandscapeClientConfig = {
      apiBaseUrl: BACKEND_ORIGIN,
      sampleIntervalMetres: 50,
      batchSize: 100,
      timeoutMs: 10000,
    };
    const result = await queryTerrain([], config);
    expect(result.ok).toEqual(true);
    if (result.ok) {
      expect(result.value.length).toEqual(0);
    }
    expect(fetchCalled).toEqual(false);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

// --- detectByLandscape ---

it("detectByLandscape - returns strategy 'landscape'", () => {
  const trackpoints = makeTrackLine(5);
  const terrainResults: TerrainResult[] = trackpoints.map((tp) =>
    makeTerrainResult(tp.coordinate.lat, tp.coordinate.lon, "land")
  );
  const result = detectByLandscape(trackpoints, terrainResults);
  expect(result.strategy).toEqual("landscape");
});

it("detectByLandscape - consecutive water points create swim segment", () => {
  const trackpoints = makeTrackLine(5);
  const terrainResults: TerrainResult[] = trackpoints.map((tp) =>
    makeTerrainResult(tp.coordinate.lat, tp.coordinate.lon, "water")
  );
  const result = detectByLandscape(trackpoints, terrainResults);
  expect(result.segments.length).toEqual(1);
  expect(result.segments[0].type).toEqual("swim");
  expect(result.segments[0].startTrackpointIndex).toEqual(0);
  expect(result.segments[0].endTrackpointIndex).toEqual(4);
});

it("detectByLandscape - consecutive land points create run segment", () => {
  const trackpoints = makeTrackLine(5);
  const terrainResults: TerrainResult[] = trackpoints.map((tp) =>
    makeTerrainResult(tp.coordinate.lat, tp.coordinate.lon, "land")
  );
  const result = detectByLandscape(trackpoints, terrainResults);
  expect(result.segments.length).toEqual(1);
  expect(result.segments[0].type).toEqual("run");
});

it("detectByLandscape - requires 2+ consecutive for segment", () => {
  const trackpoints = makeTrackLine(4);
  // Alternating: water, land, water, land → no segment of 2+ consecutive
  const terrainResults: TerrainResult[] = [
    makeTerrainResult(trackpoints[0].coordinate.lat, trackpoints[0].coordinate.lon, "water"),
    makeTerrainResult(trackpoints[1].coordinate.lat, trackpoints[1].coordinate.lon, "land"),
    makeTerrainResult(trackpoints[2].coordinate.lat, trackpoints[2].coordinate.lon, "water"),
    makeTerrainResult(trackpoints[3].coordinate.lat, trackpoints[3].coordinate.lon, "land"),
  ];
  const result = detectByLandscape(trackpoints, terrainResults);
  // Each group has only 1 point → no segments (less than 2 consecutive)
  expect(result.segments.length).toEqual(0);
});

it("detectByLandscape - transition creates two segments", () => {
  const trackpoints = makeTrackLine(6);
  const terrainResults: TerrainResult[] = [
    makeTerrainResult(trackpoints[0].coordinate.lat, trackpoints[0].coordinate.lon, "land"),
    makeTerrainResult(trackpoints[1].coordinate.lat, trackpoints[1].coordinate.lon, "land"),
    makeTerrainResult(trackpoints[2].coordinate.lat, trackpoints[2].coordinate.lon, "land"),
    makeTerrainResult(trackpoints[3].coordinate.lat, trackpoints[3].coordinate.lon, "water"),
    makeTerrainResult(trackpoints[4].coordinate.lat, trackpoints[4].coordinate.lon, "water"),
    makeTerrainResult(trackpoints[5].coordinate.lat, trackpoints[5].coordinate.lon, "water"),
  ];
  const result = detectByLandscape(trackpoints, terrainResults);
  expect(result.segments.length).toEqual(2);
  expect(result.segments[0].type).toEqual("run");
  expect(result.segments[0].startTrackpointIndex).toEqual(0);
  expect(result.segments[0].endTrackpointIndex).toEqual(2);
  expect(result.segments[1].type).toEqual("swim");
  expect(result.segments[1].startTrackpointIndex).toEqual(3);
  expect(result.segments[1].endTrackpointIndex).toEqual(5);
});

it("detectByLandscape - unknown terrain treated as previous classification", () => {
  const trackpoints = makeTrackLine(5);
  const terrainResults: TerrainResult[] = [
    makeTerrainResult(trackpoints[0].coordinate.lat, trackpoints[0].coordinate.lon, "water"),
    makeTerrainResult(trackpoints[1].coordinate.lat, trackpoints[1].coordinate.lon, "water"),
    makeTerrainResult(trackpoints[2].coordinate.lat, trackpoints[2].coordinate.lon, "unknown"),
    makeTerrainResult(trackpoints[3].coordinate.lat, trackpoints[3].coordinate.lon, "water"),
    makeTerrainResult(trackpoints[4].coordinate.lat, trackpoints[4].coordinate.lon, "water"),
  ];
  const result = detectByLandscape(trackpoints, terrainResults);
  // Unknown inherits from preceding → all water → single swim segment
  expect(result.segments.length).toEqual(1);
  expect(result.segments[0].type).toEqual("swim");
});

it("detectByLandscape - empty inputs → empty segments", () => {
  const result = detectByLandscape([], []);
  expect(result.strategy).toEqual("landscape");
  expect(result.segments.length).toEqual(0);
});

// --- calculateLandscapeConfidence ---

it("calculateLandscapeConfidence - all points agree → 1.0", () => {
  const points: TerrainResult[] = [
    makeTerrainResult(45.0, 5.0, "water"),
    makeTerrainResult(45.001, 5.0, "water"),
    makeTerrainResult(45.002, 5.0, "water"),
  ];
  const confidence = calculateLandscapeConfidence(points, "swim");
  expect(confidence).toEqual(1.0);
});

it("calculateLandscapeConfidence - no points agree → low confidence", () => {
  const points: TerrainResult[] = [
    makeTerrainResult(45.0, 5.0, "land"),
    makeTerrainResult(45.001, 5.0, "land"),
    makeTerrainResult(45.002, 5.0, "land"),
  ];
  // All land but segment is swim → 0 agreeing points / 3 total = 0 base
  const confidence = calculateLandscapeConfidence(points, "swim");
  expect(confidence <= 0.1).toEqual(true); // minimum is 0.1 due to floor
});

it("calculateLandscapeConfidence - hasRoadData boosts run to min 0.9", () => {
  const points: TerrainResult[] = [
    makeTerrainResult(45.0, 5.0, "land", true), // hasRoadData = true
    makeTerrainResult(45.001, 5.0, "land"),
  ];
  const confidence = calculateLandscapeConfidence(points, "run");
  expect(confidence >= 0.9).toEqual(true);
});

it("calculateLandscapeConfidence - unknown reduces by 0.1 per point", () => {
  const points: TerrainResult[] = [
    makeTerrainResult(45.0, 5.0, "water"),
    makeTerrainResult(45.001, 5.0, "water"),
    makeTerrainResult(45.002, 5.0, "unknown"),
    makeTerrainResult(45.003, 5.0, "unknown"),
  ];
  // 2 agreeing (water) out of 4 total → base = 0.5, minus 2*0.1 = 0.3
  const confidence = calculateLandscapeConfidence(points, "swim");
  expect(Math.abs((confidence) - (0.3))).toBeLessThanOrEqual(0.01);
});

it("calculateLandscapeConfidence - confidence floored at 0.1", () => {
  const points: TerrainResult[] = [
    makeTerrainResult(45.0, 5.0, "unknown"),
    makeTerrainResult(45.001, 5.0, "unknown"),
    makeTerrainResult(45.002, 5.0, "unknown"),
    makeTerrainResult(45.003, 5.0, "unknown"),
    makeTerrainResult(45.004, 5.0, "unknown"),
  ];
  // 0 agreeing, 5 unknown → base = 0, minus 5*0.1 → would be -0.5, but floored at 0.1
  const confidence = calculateLandscapeConfidence(points, "swim");
  expect(Math.abs((confidence) - (0.1))).toBeLessThanOrEqual(0.01);
});

it("calculateLandscapeConfidence - partial agreement", () => {
  const points: TerrainResult[] = [
    makeTerrainResult(45.0, 5.0, "water"),
    makeTerrainResult(45.001, 5.0, "water"),
    makeTerrainResult(45.002, 5.0, "land"),
  ];
  // 2 agreeing (water) / 3 total = 0.667, 0 unknown → confidence ≈ 0.667
  const confidence = calculateLandscapeConfidence(points, "swim");
  expect(Math.abs((confidence) - (0.667))).toBeLessThanOrEqual(0.01);
});
