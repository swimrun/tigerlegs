import type {
  Coordinate,
  Result,
  SegmentType,
  StrategyResult,
  StrategySegment,
  TerrainResult,
  TerrainType,
  Trackpoint,
} from "../shared/types.ts";
import { haversineDistance } from "../shared/distance-calculator.ts";

export interface LandscapeClientConfig {
  apiBaseUrl: string;
  sampleIntervalMetres: number; // max 50m between samples
  batchSize: number; // max 100 per request
  timeoutMs: number; // 10000ms default
}

/**
 * Sample coordinates along a track at specified intervals.
 * Always includes first and last trackpoint.
 * Walks along the track, emitting a coordinate every time
 * accumulated distance ≥ intervalMetres.
 */
export function sampleCoordinates(
  trackpoints: Trackpoint[],
  intervalMetres: number,
): Coordinate[] {
  if (trackpoints.length === 0) {
    return [];
  }
  if (trackpoints.length === 1) {
    return [{ ...trackpoints[0].coordinate }];
  }

  const intervalKm = intervalMetres / 1000;
  const samples: Coordinate[] = [{ ...trackpoints[0].coordinate }];
  let accumulatedDistance = 0;

  for (let i = 1; i < trackpoints.length; i++) {
    const dist = haversineDistance(
      trackpoints[i - 1].coordinate,
      trackpoints[i].coordinate,
    );
    accumulatedDistance += dist;

    if (accumulatedDistance >= intervalKm) {
      samples.push({ ...trackpoints[i].coordinate });
      accumulatedDistance = 0;
    }
  }

  // Always include the last trackpoint
  const lastCoord = trackpoints[trackpoints.length - 1].coordinate;
  const lastSample = samples[samples.length - 1];
  if (lastSample.lat !== lastCoord.lat || lastSample.lon !== lastCoord.lon) {
    samples.push({ ...lastCoord });
  }

  return samples;
}

/**
 * Query terrain types from backend in batches.
 * POST to `{apiBaseUrl}/api/v1/terrain/batch` in batches of `batchSize`.
 * Uses AbortController with timeoutMs. Returns Result with error if any batch fails.
 */
export async function queryTerrain(
  coordinates: Coordinate[],
  config: LandscapeClientConfig,
): Promise<Result<TerrainResult[]>> {
  if (coordinates.length === 0) {
    return { ok: true, value: [] };
  }

  const results: TerrainResult[] = [];
  const batches: Coordinate[][] = [];

  // Split coordinates into batches
  for (let i = 0; i < coordinates.length; i += config.batchSize) {
    batches.push(coordinates.slice(i, i + config.batchSize));
  }

  for (const batch of batches) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), config.timeoutMs);

    try {
      const response = await fetch(
        `${config.apiBaseUrl}/api/v1/terrain/batch`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ coordinates: batch }),
          signal: controller.signal,
        },
      );

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorBody = await response.text();
        return {
          ok: false,
          error: `Terrain API returned status ${response.status}: ${errorBody}`,
        };
      }

      const batchResults: TerrainResult[] = await response.json();
      results.push(...batchResults);
    } catch (error: unknown) {
      clearTimeout(timeoutId);
      if (error instanceof DOMException && error.name === "AbortError") {
        return {
          ok: false,
          error: `Terrain API request timed out after ${config.timeoutMs}ms`,
        };
      }
      const message = error instanceof Error ? error.message : String(error);
      return {
        ok: false,
        error: `Terrain API request failed: ${message}`,
      };
    }
  }

  return { ok: true, value: results };
}

/**
 * Resolve unknown terrain types by inheriting from the preceding classification.
 * Returns a new array with unknown types replaced.
 */
function resolveUnknownTerrain(terrainResults: TerrainResult[]): TerrainType[] {
  const resolved: TerrainType[] = [];
  let lastKnownType: TerrainType = "land"; // default if first point is unknown

  for (const result of terrainResults) {
    if (result.terrainType === "unknown") {
      resolved.push(lastKnownType);
    } else {
      resolved.push(result.terrainType);
      lastKnownType = result.terrainType;
    }
  }

  return resolved;
}

/**
 * Detect segments from terrain data.
 * From terrain results mapped to trackpoints, find consecutive runs
 * of same terrain type (≥2 points). Create StrategySegment for each.
 */
export function detectByLandscape(
  trackpoints: Trackpoint[],
  terrainResults: TerrainResult[],
): StrategyResult {
  if (trackpoints.length === 0 || terrainResults.length === 0) {
    return { strategy: "landscape", segments: [] };
  }

  // Resolve unknown terrain by inheriting from preceding
  const resolvedTypes = resolveUnknownTerrain(terrainResults);

  // Find consecutive runs of same terrain type
  const segments: StrategySegment[] = [];
  let runStart = 0;
  let currentType = resolvedTypes[0];

  for (let i = 1; i <= resolvedTypes.length; i++) {
    if (i === resolvedTypes.length || resolvedTypes[i] !== currentType) {
      const runLength = i - runStart;
      // Only create segment if 2+ consecutive points
      if (runLength >= 2) {
        const segmentType: SegmentType =
          currentType === "water" ? "swim" : "run";
        const segmentPoints = terrainResults.slice(runStart, i);
        const confidence = calculateLandscapeConfidence(
          segmentPoints,
          segmentType,
        );

        segments.push({
          type: segmentType,
          startTrackpointIndex: trackpoints[runStart].index,
          endTrackpointIndex: trackpoints[Math.min(i - 1, trackpoints.length - 1)].index,
          confidenceScore: confidence,
        });
      }

      if (i < resolvedTypes.length) {
        runStart = i;
        currentType = resolvedTypes[i];
      }
    }
  }

  return { strategy: "landscape", segments };
}

/**
 * Calculate landscape confidence based on point agreement ratio.
 *
 * confidence = agreeing points / total points
 * - If any point has hasRoadData=true and segment is "run", boost to min 0.9
 * - Reduce by 0.1 per "unknown" terrain point
 * - Floor at 0.1
 */
export function calculateLandscapeConfidence(
  points: TerrainResult[],
  segmentType: SegmentType,
): number {
  if (points.length === 0) {
    return 0;
  }

  const expectedTerrain: TerrainType =
    segmentType === "swim" ? "water" : "land";

  // Count agreeing points (those matching expected terrain, not unknown)
  let agreeingCount = 0;
  let unknownCount = 0;
  let hasRoadData = false;

  for (const point of points) {
    if (point.terrainType === expectedTerrain) {
      agreeingCount++;
    }
    if (point.terrainType === "unknown") {
      unknownCount++;
    }
    if (point.hasRoadData) {
      hasRoadData = true;
    }
  }

  // Base confidence = agreeing / total
  let confidence = agreeingCount / points.length;

  // Reduce by 0.1 per unknown point
  confidence -= unknownCount * 0.1;

  // Boost for road data on run segments
  if (hasRoadData && segmentType === "run") {
    confidence = Math.max(confidence, 0.9);
  }

  // Floor at 0.1
  confidence = Math.max(confidence, 0.1);

  return confidence;
}
