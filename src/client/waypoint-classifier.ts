import type {
  ClassifiedWaypoint,
  StrategyResult,
  StrategySegment,
  Trackpoint,
  ValidationResult,
  Waypoint,
  WaypointType,
} from "../shared/types.ts";
import { findNearestTrackpoint } from "../shared/distance-calculator.ts";

/**
 * Classify a single waypoint by its sym value or name pattern.
 *
 * Classification rules (mutually exclusive, checked in order):
 * 1. sym="200" OR name starts with "Début SWIM" (case-sensitive) → "swim-start"
 * 2. sym="201" OR name starts with "Fin SWIM" (case-sensitive) → "swim-end"
 * 3. sym="3" OR name contains "Ravitaillement" (case-insensitive) → "aid-station"
 * 4. Everything else → "other"
 */
export function classifyWaypoint(waypoint: Waypoint): WaypointType {
  // Rule 1: swim-start
  if (
    waypoint.symbol === "200" ||
    waypoint.name.startsWith("Début SWIM")
  ) {
    return "swim-start";
  }

  // Rule 2: swim-end
  if (
    waypoint.symbol === "201" ||
    waypoint.name.startsWith("Fin SWIM")
  ) {
    return "swim-end";
  }

  // Rule 3: aid-station
  if (
    waypoint.symbol === "3" ||
    waypoint.name.toLowerCase().includes("ravitaillement")
  ) {
    return "aid-station";
  }

  // Rule 4: everything else
  return "other";
}

/**
 * Classify all waypoints and filter out those classified as "other".
 * Returns only swim-start, swim-end, and aid-station waypoints.
 */
export function classifyWaypoints(
  waypoints: Waypoint[],
): ClassifiedWaypoint[] {
  return waypoints
    .map((waypoint) => ({
      waypoint,
      type: classifyWaypoint(waypoint),
    }))
    .filter((classified) => classified.type !== "other");
}

/**
 * Validate that swim-start and swim-end waypoints are properly paired.
 * The Nth swim-start must have a corresponding Nth swim-end.
 */
export function validateSwimPairing(
  classified: ClassifiedWaypoint[],
): ValidationResult {
  const swimStarts = classified.filter((c) => c.type === "swim-start");
  const swimEnds = classified.filter((c) => c.type === "swim-end");

  if (swimStarts.length > swimEnds.length) {
    return {
      valid: false,
      error:
        `Unpaired swim-start waypoint found: ${swimStarts.length} swim-start(s) but only ${swimEnds.length} swim-end(s)`,
    };
  }

  return { valid: true };
}

/**
 * Full waypoint-based detection strategy.
 *
 * Pairs swim-start/swim-end waypoints in file-appearance order,
 * maps each to the nearest trackpoint within 50m, and creates
 * alternating swim/run segments with confidence 0.95.
 *
 * Segments cover the full track:
 * - If the first classified waypoint is a swim-start, the first segment is swim
 * - Otherwise a run segment precedes the first swim
 * - After the last swim-end, a run segment covers the remaining track
 */
export function detectByWaypoint(
  waypoints: Waypoint[],
  trackpoints: Trackpoint[],
): StrategyResult {
  const classified = classifyWaypoints(waypoints);
  const segments: StrategySegment[] = [];

  // Extract swim-start and swim-end waypoints in file order
  const swimStarts = classified.filter((c) => c.type === "swim-start");
  const swimEnds = classified.filter((c) => c.type === "swim-end");

  // Pair Nth start with Nth end
  const pairCount = Math.min(swimStarts.length, swimEnds.length);

  if (pairCount === 0) {
    // No swim pairs — entire track is a run
    if (trackpoints.length > 0) {
      segments.push({
        type: "run",
        startTrackpointIndex: 0,
        endTrackpointIndex: trackpoints.length - 1,
        confidenceScore: 0.95,
      });
    }
    return { strategy: "waypoint", segments };
  }

  // Map each swim waypoint to its nearest trackpoint index
  const startIndices: (number | null)[] = [];
  const endIndices: (number | null)[] = [];

  for (let i = 0; i < pairCount; i++) {
    const startIdx = findNearestTrackpoint(
      swimStarts[i].waypoint.coordinate,
      trackpoints,
    );
    const endIdx = findNearestTrackpoint(
      swimEnds[i].waypoint.coordinate,
      trackpoints,
    );
    startIndices.push(startIdx);
    endIndices.push(endIdx);
  }

  // Build alternating segments
  let currentIndex = 0;

  for (let i = 0; i < pairCount; i++) {
    const swimStartIdx = startIndices[i];
    const swimEndIdx = endIndices[i];

    // Skip pairs where waypoints couldn't be matched to trackpoints
    if (swimStartIdx === null || swimEndIdx === null) {
      continue;
    }

    // Run segment before this swim (if there's a gap)
    if (currentIndex < swimStartIdx) {
      segments.push({
        type: "run",
        startTrackpointIndex: currentIndex,
        endTrackpointIndex: swimStartIdx - 1,
        confidenceScore: 0.95,
      });
    }

    // Swim segment
    segments.push({
      type: "swim",
      startTrackpointIndex: swimStartIdx,
      endTrackpointIndex: swimEndIdx,
      confidenceScore: 0.95,
    });

    currentIndex = swimEndIdx + 1;
  }

  // Final run segment after last swim-end (if there are remaining trackpoints)
  if (currentIndex < trackpoints.length) {
    segments.push({
      type: "run",
      startTrackpointIndex: currentIndex,
      endTrackpointIndex: trackpoints.length - 1,
      confidenceScore: 0.95,
    });
  }

  return { strategy: "waypoint", segments };
}
