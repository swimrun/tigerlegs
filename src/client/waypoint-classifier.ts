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

/** Pattern configuration for waypoint classification */
export interface WaypointPatterns {
  swimStart: {
    symValues: string[];
    nameContains: string[];
  };
  swimEnd: {
    symValues: string[];
    nameContains: string[];
  };
  aidStation: {
    symValues: string[];
    nameContains: string[];
  };
}

/**
 * Default matching patterns for waypoint classification.
 * All name patterns are matched case-insensitively.
 * Users can override this to add custom patterns for their race organiser's conventions.
 */
export const DEFAULT_PATTERNS: WaypointPatterns = {
  swimStart: {
    symValues: ["200"],
    nameContains: [
      "swim start",
      "swim entry",
      "water entry",
      "début swim",
      "start swim",
      "zwem start",
      "begin zwem",
    ],
  },
  swimEnd: {
    symValues: ["201"],
    nameContains: [
      "swim end",
      "swim exit",
      "water exit",
      "fin swim",
      "end swim",
      "zwem eind",
      "einde zwem",
    ],
  },
  aidStation: {
    symValues: ["3", "49"],
    nameContains: [
      "ravitaillement",
      "aid station",
      "feed zone",
      "energy post",
      "food",
      "drink",
      "verzorging",
      "voeding",
      "verpflegung",
    ],
  },
};

/**
 * Classify a single waypoint by its sym value or name pattern.
 *
 * Classification rules (ALL case-insensitive, checked in order):
 * 1. swim-start: sym matches OR name contains any swim-start pattern
 * 2. swim-end: sym matches OR name contains any swim-end pattern
 * 3. aid-station: sym matches OR name contains any aid-station pattern
 * 4. Everything else → "other"
 *
 * @param waypoint The waypoint to classify
 * @param patterns Optional custom patterns (defaults to DEFAULT_PATTERNS)
 */
export function classifyWaypoint(
  waypoint: Waypoint,
  patterns: WaypointPatterns = DEFAULT_PATTERNS,
): WaypointType {
  const nameLower = waypoint.name.toLowerCase();

  // Rule 1: swim-start
  if (
    patterns.swimStart.symValues.includes(waypoint.symbol) ||
    patterns.swimStart.nameContains.some((p) => nameLower.includes(p))
  ) {
    return "swim-start";
  }

  // Rule 2: swim-end
  if (
    patterns.swimEnd.symValues.includes(waypoint.symbol) ||
    patterns.swimEnd.nameContains.some((p) => nameLower.includes(p))
  ) {
    return "swim-end";
  }

  // Rule 3: aid-station
  if (
    patterns.aidStation.symValues.includes(waypoint.symbol) ||
    patterns.aidStation.nameContains.some((p) => nameLower.includes(p))
  ) {
    return "aid-station";
  }

  // Rule 4: everything else
  return "other";
}

/**
 * Classify all waypoints and filter out those classified as "other".
 * Returns only swim-start, swim-end, and aid-station waypoints.
 *
 * @param waypoints Array of waypoints to classify
 * @param patterns Optional custom patterns (defaults to DEFAULT_PATTERNS)
 */
export function classifyWaypoints(
  waypoints: Waypoint[],
  patterns: WaypointPatterns = DEFAULT_PATTERNS,
): ClassifiedWaypoint[] {
  return waypoints
    .map((waypoint) => ({
      waypoint,
      type: classifyWaypoint(waypoint, patterns),
    }))
    .filter((classified) => classified.type !== "other");
}

/**
 * Validate that swim-start and swim-end waypoints are properly paired.
 * Returns an error if any swim-start lacks a matching swim-end.
 *
 * @param classified Array of classified waypoints to validate
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
 * Full waypoint-based detection pipeline.
 *
 * Steps:
 * 1. Classify all waypoints
 * 2. Validate swim pairing
 * 3. Map each swim waypoint to nearest trackpoint (50m radius)
 * 4. Build alternating swim/run StrategySegments with confidence 0.95
 *
 * Edge cases handled:
 * - Track starting with a swim (no preceding run segment)
 * - Track ending after a swim-end (trailing run segment added)
 * - Waypoints too far from track (>50m) are skipped
 * - Unpaired swim-start waypoints are excluded
 *
 * @param waypoints Array of GPX waypoints
 * @param trackpoints Array of GPX trackpoints
 * @param patterns Optional custom patterns (defaults to DEFAULT_PATTERNS)
 */
export function detectByWaypoint(
  waypoints: Waypoint[],
  trackpoints: Trackpoint[],
  patterns: WaypointPatterns = DEFAULT_PATTERNS,
): StrategyResult {
  const classified = classifyWaypoints(waypoints, patterns);
  const validation = validateSwimPairing(classified);
  const segments: StrategySegment[] = [];

  const CONFIDENCE = 0.95;

  // Extract swim-start and swim-end waypoints in file order
  const swimStarts = classified.filter((c) => c.type === "swim-start");
  const swimEnds = classified.filter((c) => c.type === "swim-end");

  // Only use valid pairs (if validation fails, exclude unpaired starts)
  const pairCount = Math.min(swimStarts.length, swimEnds.length);

  if (pairCount === 0 || trackpoints.length === 0) {
    // No swim pairs or no trackpoints — entire track is a run (if trackpoints exist)
    if (trackpoints.length > 0) {
      segments.push({
        type: "run",
        startTrackpointIndex: 0,
        endTrackpointIndex: trackpoints.length - 1,
        confidenceScore: CONFIDENCE,
      });
    }
    return { strategy: "waypoint", segments };
  }

  // Map each swim waypoint to its nearest trackpoint index (50m radius)
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
        confidenceScore: CONFIDENCE,
      });
    }

    // Swim segment
    segments.push({
      type: "swim",
      startTrackpointIndex: swimStartIdx,
      endTrackpointIndex: swimEndIdx,
      confidenceScore: CONFIDENCE,
    });

    currentIndex = swimEndIdx + 1;
  }

  // Final run segment after last swim-end (if there are remaining trackpoints)
  if (currentIndex < trackpoints.length) {
    segments.push({
      type: "run",
      startTrackpointIndex: currentIndex,
      endTrackpointIndex: trackpoints.length - 1,
      confidenceScore: CONFIDENCE,
    });
  }

  // If no segments were built (all pairs skipped due to distance), add a full run
  if (segments.length === 0 && trackpoints.length > 0) {
    segments.push({
      type: "run",
      startTrackpointIndex: 0,
      endTrackpointIndex: trackpoints.length - 1,
      confidenceScore: CONFIDENCE,
    });
  }

  return { strategy: "waypoint", segments };
}
