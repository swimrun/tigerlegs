import type {
  GPXData,
  Segment,
  SegmentType,
  StrategyName,
  StrategyResult,
  StrategySegment,
  Trackpoint,
} from "../shared/types.ts";
import { haversineDistance } from "../shared/distance-calculator.ts";

/**
 * Information about a conflict between strategies at a boundary.
 */
export interface ConflictInfo {
  trackpointIndex: number;
  strategies: StrategyName[];
  resolvedBy: StrategyName;
}

/**
 * Determine which detection strategies are applicable for the given GPX data.
 *
 * - Waypoint: requires ≥1 waypoint with sym 200/201 or name starting with "Début SWIM"/"Fin SWIM"
 * - Speed: requires ≥2 consecutive trackpoints with valid timestamps
 * - Landscape: always applicable (requires coordinates, which tracks always have)
 */
export function detectApplicableStrategies(gpxData: GPXData): StrategyName[] {
  const strategies: StrategyName[] = [];

  // Get all trackpoints from all tracks
  const allTrackpoints = gpxData.tracks.flatMap((t) => t.trackpoints);

  // No trackpoints at all → no strategies applicable
  if (allTrackpoints.length === 0) {
    return [];
  }

  // Landscape: always applicable when we have coordinates
  strategies.push("landscape");

  // Speed: requires ≥2 consecutive trackpoints with valid timestamps
  for (let i = 0; i < allTrackpoints.length - 1; i++) {
    if (
      allTrackpoints[i].timestamp !== null &&
      allTrackpoints[i + 1].timestamp !== null
    ) {
      strategies.push("speed");
      break;
    }
  }

  // Waypoint: requires ≥1 waypoint with sym 200/201 or name starting with "Début SWIM"/"Fin SWIM"
  const hasSwimWaypoint = gpxData.waypoints.some((wp) => {
    if (wp.symbol === "200" || wp.symbol === "201") {
      return true;
    }
    const nameLower = wp.name.toLowerCase();
    if (
      nameLower.startsWith("début swim") ||
      nameLower.startsWith("fin swim")
    ) {
      return true;
    }
    return false;
  });

  if (hasSwimWaypoint) {
    strategies.push("waypoint");
  }

  return strategies;
}

/**
 * Per-trackpoint resolution: which type and confidence does each strategy assign?
 */
interface TrackpointClassification {
  type: SegmentType;
  confidence: number;
  strategies: StrategyName[];
}

/**
 * Combine multiple strategy results into a final segmentation.
 *
 * For each trackpoint index, determine which strategy claims it and at what confidence.
 * Use highest confidence per trackpoint to determine segment type.
 * Merge consecutive same-type trackpoints into segments.
 * If all strategies give confidence < 0.3 for a region, mark as "unclassified".
 * Ensure output covers all trackpoints (0 to trackpointCount-1) contiguously.
 * Number segments sequentially.
 */
export function combineStrategies(
  results: StrategyResult[],
  trackpointCount: number,
): Segment[] {
  if (trackpointCount === 0) {
    return [];
  }

  // Classify each trackpoint
  const classifications: TrackpointClassification[] = new Array(trackpointCount);

  for (let i = 0; i < trackpointCount; i++) {
    let bestType: SegmentType = "unclassified";
    let bestConfidence = 0;
    const contributingStrategies: StrategyName[] = [];

    for (const result of results) {
      for (const segment of result.segments) {
        if (i >= segment.startTrackpointIndex && i <= segment.endTrackpointIndex) {
          // This strategy covers this trackpoint
          if (segment.confidenceScore > bestConfidence) {
            bestConfidence = segment.confidenceScore;
            bestType = segment.type;
          }
          if (!contributingStrategies.includes(result.strategy)) {
            contributingStrategies.push(result.strategy);
          }
        }
      }
    }

    // If all confidence is below 0.3, mark as unclassified
    if (bestConfidence < 0.3) {
      bestType = "unclassified";
    }

    classifications[i] = {
      type: bestType,
      confidence: bestConfidence,
      strategies: contributingStrategies,
    };
  }

  // Merge consecutive same-type trackpoints into segments
  const segments: Segment[] = [];
  let segStart = 0;
  let currentType = classifications[0].type;

  for (let i = 1; i <= trackpointCount; i++) {
    if (i === trackpointCount || classifications[i].type !== currentType) {
      // Find the best confidence and contributing strategies for this region
      let maxConfidence = 0;
      const regionStrategies = new Set<StrategyName>();

      for (let j = segStart; j < i; j++) {
        if (classifications[j].confidence > maxConfidence) {
          maxConfidence = classifications[j].confidence;
        }
        for (const s of classifications[j].strategies) {
          regionStrategies.add(s);
        }
      }

      segments.push({
        number: segments.length + 1,
        type: currentType,
        startTrackpointIndex: segStart,
        endTrackpointIndex: i - 1,
        distanceKm: 0, // To be calculated externally
        detectedBy: Array.from(regionStrategies),
        confidenceScore: maxConfidence,
        gpsFiltered: false,
      });

      if (i < trackpointCount) {
        segStart = i;
        currentType = classifications[i].type;
      }
    }
  }

  return segments;
}

/**
 * Extract boundaries from a strategy result.
 * A boundary is a transition point between two adjacent segments of different types.
 */
interface Boundary {
  trackpointIndex: number; // Last index of the preceding segment
  fromType: SegmentType;
  toType: SegmentType;
  strategy: StrategyName;
  confidence: number;
}

function extractBoundaries(result: StrategyResult): Boundary[] {
  const boundaries: Boundary[] = [];
  const sortedSegments = [...result.segments].sort(
    (a, b) => a.startTrackpointIndex - b.startTrackpointIndex,
  );

  for (let i = 0; i < sortedSegments.length - 1; i++) {
    const current = sortedSegments[i];
    const next = sortedSegments[i + 1];

    if (current.type !== next.type) {
      boundaries.push({
        trackpointIndex: current.endTrackpointIndex,
        fromType: current.type,
        toType: next.type,
        strategy: result.strategy,
        confidence: Math.max(current.confidenceScore, next.confidenceScore),
      });
    }
  }

  return boundaries;
}

/**
 * Detect boundary conflicts between strategies.
 * Two boundaries within 100m of each other for the same transition type = conflict.
 * Records which strategy resolved the conflict (highest confidence).
 */
export function detectConflicts(
  results: StrategyResult[],
  trackpoints: Trackpoint[],
): ConflictInfo[] {
  if (results.length < 2) {
    return [];
  }

  // Extract all boundaries from all strategies
  const allBoundaries: Boundary[] = [];
  for (const result of results) {
    allBoundaries.push(...extractBoundaries(result));
  }

  const conflicts: ConflictInfo[] = [];
  const processed = new Set<string>();

  // Compare each pair of boundaries from different strategies
  for (let i = 0; i < allBoundaries.length; i++) {
    for (let j = i + 1; j < allBoundaries.length; j++) {
      const a = allBoundaries[i];
      const b = allBoundaries[j];

      // Must be different strategies
      if (a.strategy === b.strategy) continue;

      // Must be same transition type (same fromType → toType)
      if (a.fromType !== b.fromType || a.toType !== b.toType) continue;

      // Check distance between boundary trackpoints
      const idxA = a.trackpointIndex;
      const idxB = b.trackpointIndex;

      // Same boundary index = agreement, not a conflict
      if (idxA === idxB) continue;

      if (
        idxA < 0 || idxA >= trackpoints.length ||
        idxB < 0 || idxB >= trackpoints.length
      ) {
        continue;
      }

      const distance = haversineDistance(
        trackpoints[idxA].coordinate,
        trackpoints[idxB].coordinate,
      );

      // 100m = 0.1 km
      if (distance <= 0.1) {
        // This is a conflict
        const key = `${Math.min(idxA, idxB)}-${Math.max(idxA, idxB)}-${a.fromType}-${a.toType}`;
        if (processed.has(key)) continue;
        processed.add(key);

        const resolvedBy = a.confidence >= b.confidence
          ? a.strategy
          : b.strategy;
        const resolvedIndex = a.confidence >= b.confidence
          ? a.trackpointIndex
          : b.trackpointIndex;

        conflicts.push({
          trackpointIndex: resolvedIndex,
          strategies: [a.strategy, b.strategy],
          resolvedBy,
        });
      }
    }
  }

  return conflicts;
}
