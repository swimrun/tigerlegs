import { assertEquals, assertAlmostEquals } from "@std/assert";
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

Deno.test("sampleCoordinates - always includes first and last trackpoint", () => {
  const trackpoints = makeTrackLine(10, 45.0, 5.0, 0.001); // ~111m apart
  const samples = sampleCoordinates(trackpoints, 50);
  assertEquals(samples[0].lat, trackpoints[0].coordinate.lat);
  assertEquals(samples[0].lon, trackpoints[0].coordinate.lon);
  assertEquals(samples[samples.length - 1].lat, trackpoints[trackpoints.length - 1].coordinate.lat);
  assertEquals(samples[samples.length - 1].lon, trackpoints[trackpoints.length - 1].coordinate.lon);
});

Deno.test("sampleCoordinates - samples at intervals ≤ intervalMetres", () => {
  // Points ~111m apart, sample every 50m → should get at least 2 samples per segment
  const trackpoints = makeTrackLine(10, 45.0, 5.0, 0.001);
  const samples = sampleCoordinates(trackpoints, 50);
  // With 9 segments of ~111m each, total ~1000m, at 50m intervals ≈ 20 samples
  assertEquals(samples.length >= 10, true);
});

Deno.test("sampleCoordinates - single trackpoint returns that trackpoint", () => {
  const trackpoints = [makeTrackpoint(0, 45.0, 5.0)];
  const samples = sampleCoordinates(trackpoints, 50);
  assertEquals(samples.length, 1);
  assertEquals(samples[0].lat, 45.0);
  assertEquals(samples[0].lon, 5.0);
});

Deno.test("sampleCoordinates - two trackpoints always returns both", () => {
  const trackpoints = [
    makeTrackpoint(0, 45.0, 5.0),
    makeTrackpoint(1, 45.001, 5.0), // ~111m apart
  ];
  const samples = sampleCoordinates(trackpoints, 50);
  assertEquals(samples.length >= 2, true);
  assertEquals(samples[0].lat, 45.0);
  assertEquals(samples[samples.length - 1].lat, 45.001);
});

Deno.test("sampleCoordinates - empty trackpoints returns empty array", () => {
  const samples = sampleCoordinates([], 50);
  assertEquals(samples.length, 0);
});

Deno.test("sampleCoordinates - closely spaced points (< interval) still include first and last", () => {
  // Points 10m apart, interval 50m → should skip many intermediate points
  const trackpoints = makeTrackLine(20, 45.0, 5.0, 0.00009); // ~10m apart
  const samples = sampleCoordinates(trackpoints, 50);
  assertEquals(samples[0].lat, trackpoints[0].coordinate.lat);
  assertEquals(samples[samples.length - 1].lat, trackpoints[trackpoints.length - 1].coordinate.lat);
  // 20 points × 10m = ~190m total; at 50m intervals → expect about 4-5 samples
  assertEquals(samples.length >= 3, true);
  assertEquals(samples.length <= 10, true);
});

// --- queryTerrain ---

Deno.test("queryTerrain - batches requests (max batchSize per request)", async () => {
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
      apiBaseUrl: "http://localhost:8000",
      sampleIntervalMetres: 50,
      batchSize: 100,
      timeoutMs: 10000,
    };
    const result = await queryTerrain(coordinates, config);
    assertEquals(result.ok, true);
    if (result.ok) {
      assertEquals(result.value.length, 250);
    }
    // 250 coords / 100 batch size = 3 requests
    assertEquals(requestCount, 3);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

Deno.test("queryTerrain - returns error on fetch failure", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (_input: string | URL | Request, _init?: RequestInit) => {
    throw new Error("Network failure");
  };

  try {
    const config: LandscapeClientConfig = {
      apiBaseUrl: "http://localhost:8000",
      sampleIntervalMetres: 50,
      batchSize: 100,
      timeoutMs: 10000,
    };
    const coordinates: Coordinate[] = [{ lat: 45.0, lon: 5.0 }];
    const result = await queryTerrain(coordinates, config);
    assertEquals(result.ok, false);
    if (!result.ok) {
      assertEquals(result.error.includes("Network failure") || result.error.length > 0, true);
    }
  } finally {
    globalThis.fetch = originalFetch;
  }
});

Deno.test("queryTerrain - returns error on non-200 response", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (_input: string | URL | Request, _init?: RequestInit) => {
    return new Response(JSON.stringify({ error: "Server error", code: "INTERNAL_ERROR" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  };

  try {
    const config: LandscapeClientConfig = {
      apiBaseUrl: "http://localhost:8000",
      sampleIntervalMetres: 50,
      batchSize: 100,
      timeoutMs: 10000,
    };
    const coordinates: Coordinate[] = [{ lat: 45.0, lon: 5.0 }];
    const result = await queryTerrain(coordinates, config);
    assertEquals(result.ok, false);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

Deno.test("queryTerrain - empty coordinates returns empty results", async () => {
  const originalFetch = globalThis.fetch;
  // Should not even call fetch for empty input
  let fetchCalled = false;
  globalThis.fetch = async (_input: string | URL | Request, _init?: RequestInit) => {
    fetchCalled = true;
    return new Response("[]", { status: 200 });
  };

  try {
    const config: LandscapeClientConfig = {
      apiBaseUrl: "http://localhost:8000",
      sampleIntervalMetres: 50,
      batchSize: 100,
      timeoutMs: 10000,
    };
    const result = await queryTerrain([], config);
    assertEquals(result.ok, true);
    if (result.ok) {
      assertEquals(result.value.length, 0);
    }
    assertEquals(fetchCalled, false);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

// --- detectByLandscape ---

Deno.test("detectByLandscape - returns strategy 'landscape'", () => {
  const trackpoints = makeTrackLine(5);
  const terrainResults: TerrainResult[] = trackpoints.map((tp) =>
    makeTerrainResult(tp.coordinate.lat, tp.coordinate.lon, "land")
  );
  const result = detectByLandscape(trackpoints, terrainResults);
  assertEquals(result.strategy, "landscape");
});

Deno.test("detectByLandscape - consecutive water points create swim segment", () => {
  const trackpoints = makeTrackLine(5);
  const terrainResults: TerrainResult[] = trackpoints.map((tp) =>
    makeTerrainResult(tp.coordinate.lat, tp.coordinate.lon, "water")
  );
  const result = detectByLandscape(trackpoints, terrainResults);
  assertEquals(result.segments.length, 1);
  assertEquals(result.segments[0].type, "swim");
  assertEquals(result.segments[0].startTrackpointIndex, 0);
  assertEquals(result.segments[0].endTrackpointIndex, 4);
});

Deno.test("detectByLandscape - consecutive land points create run segment", () => {
  const trackpoints = makeTrackLine(5);
  const terrainResults: TerrainResult[] = trackpoints.map((tp) =>
    makeTerrainResult(tp.coordinate.lat, tp.coordinate.lon, "land")
  );
  const result = detectByLandscape(trackpoints, terrainResults);
  assertEquals(result.segments.length, 1);
  assertEquals(result.segments[0].type, "run");
});

Deno.test("detectByLandscape - requires 2+ consecutive for segment", () => {
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
  assertEquals(result.segments.length, 0);
});

Deno.test("detectByLandscape - transition creates two segments", () => {
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
  assertEquals(result.segments.length, 2);
  assertEquals(result.segments[0].type, "run");
  assertEquals(result.segments[0].startTrackpointIndex, 0);
  assertEquals(result.segments[0].endTrackpointIndex, 2);
  assertEquals(result.segments[1].type, "swim");
  assertEquals(result.segments[1].startTrackpointIndex, 3);
  assertEquals(result.segments[1].endTrackpointIndex, 5);
});

Deno.test("detectByLandscape - unknown terrain treated as previous classification", () => {
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
  assertEquals(result.segments.length, 1);
  assertEquals(result.segments[0].type, "swim");
});

Deno.test("detectByLandscape - empty inputs → empty segments", () => {
  const result = detectByLandscape([], []);
  assertEquals(result.strategy, "landscape");
  assertEquals(result.segments.length, 0);
});

// --- calculateLandscapeConfidence ---

Deno.test("calculateLandscapeConfidence - all points agree → 1.0", () => {
  const points: TerrainResult[] = [
    makeTerrainResult(45.0, 5.0, "water"),
    makeTerrainResult(45.001, 5.0, "water"),
    makeTerrainResult(45.002, 5.0, "water"),
  ];
  const confidence = calculateLandscapeConfidence(points, "swim");
  assertEquals(confidence, 1.0);
});

Deno.test("calculateLandscapeConfidence - no points agree → low confidence", () => {
  const points: TerrainResult[] = [
    makeTerrainResult(45.0, 5.0, "land"),
    makeTerrainResult(45.001, 5.0, "land"),
    makeTerrainResult(45.002, 5.0, "land"),
  ];
  // All land but segment is swim → 0 agreeing points / 3 total = 0 base
  const confidence = calculateLandscapeConfidence(points, "swim");
  assertEquals(confidence <= 0.1, true); // minimum is 0.1 due to floor
});

Deno.test("calculateLandscapeConfidence - hasRoadData boosts run to min 0.9", () => {
  const points: TerrainResult[] = [
    makeTerrainResult(45.0, 5.0, "land", true), // hasRoadData = true
    makeTerrainResult(45.001, 5.0, "land"),
  ];
  const confidence = calculateLandscapeConfidence(points, "run");
  assertEquals(confidence >= 0.9, true);
});

Deno.test("calculateLandscapeConfidence - unknown reduces by 0.1 per point", () => {
  const points: TerrainResult[] = [
    makeTerrainResult(45.0, 5.0, "water"),
    makeTerrainResult(45.001, 5.0, "water"),
    makeTerrainResult(45.002, 5.0, "unknown"),
    makeTerrainResult(45.003, 5.0, "unknown"),
  ];
  // 2 agreeing (water) out of 4 total → base = 0.5, minus 2*0.1 = 0.3
  const confidence = calculateLandscapeConfidence(points, "swim");
  assertAlmostEquals(confidence, 0.3, 0.01);
});

Deno.test("calculateLandscapeConfidence - confidence floored at 0.1", () => {
  const points: TerrainResult[] = [
    makeTerrainResult(45.0, 5.0, "unknown"),
    makeTerrainResult(45.001, 5.0, "unknown"),
    makeTerrainResult(45.002, 5.0, "unknown"),
    makeTerrainResult(45.003, 5.0, "unknown"),
    makeTerrainResult(45.004, 5.0, "unknown"),
  ];
  // 0 agreeing, 5 unknown → base = 0, minus 5*0.1 → would be -0.5, but floored at 0.1
  const confidence = calculateLandscapeConfidence(points, "swim");
  assertAlmostEquals(confidence, 0.1, 0.01);
});

Deno.test("calculateLandscapeConfidence - partial agreement", () => {
  const points: TerrainResult[] = [
    makeTerrainResult(45.0, 5.0, "water"),
    makeTerrainResult(45.001, 5.0, "water"),
    makeTerrainResult(45.002, 5.0, "land"),
  ];
  // 2 agreeing (water) / 3 total = 0.667, 0 unknown → confidence ≈ 0.667
  const confidence = calculateLandscapeConfidence(points, "swim");
  assertAlmostEquals(confidence, 0.667, 0.01);
});
