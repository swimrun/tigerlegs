import type {
  ClassifiedWaypoint,
  DisplaySegmentPair,
  Result,
  Segment,
  SegmentTotals,
  Trackpoint,
} from "../shared/types.ts";
import { calculateTrackDistance } from "../shared/distance-calculator.ts";
import { detectByWaypoint } from "./waypoint-classifier.ts";

/**
 * Round swim distance to nearest 50 metres (ADR-0007).
 * Examples: 387→400, 1125→1150, 2220→2200
 */
export function roundSwimDistance(metres: number): number {
  return Math.round(metres / 50) * 50;
}

/**
 * Round run distance to nearest 0.1 km (ADR-0007).
 * Examples: 5.23→5.2, 1.37→1.4
 */
export function roundRunDistance(km: number): number {
  // Drop binary noise first: a total that is exactly 60.65 km can be stored as 60.6499999999999986 or
  // 60.65000000000001 depending on the order of the additions, and must round the same way (up) either way.
  return Math.round(Number((km * 10).toPrecision(12))) / 10;
}

/**
 * Build segments from trackpoints and classified waypoints.
 * Uses the waypoint classifier to detect swim/run boundaries,
 * then calculates distance for each segment.
 *
 * Returns a Result containing numbered Segment[] with distances.
 */
export function buildSegments(
  trackpoints: Trackpoint[],
  classifiedWaypoints: ClassifiedWaypoint[],
): Result<Segment[]> {
  if (trackpoints.length === 0) {
    return { ok: false, error: "No trackpoints provided" };
  }

  // Extract waypoints from classified list for detectByWaypoint
  const waypoints = classifiedWaypoints.map((cw) => cw.waypoint);

  // Use waypoint-based detection to get strategy segments
  const strategyResult = detectByWaypoint(waypoints, trackpoints);

  // Convert strategy segments to full Segment objects with distances
  const segments: Segment[] = strategyResult.segments.map(
    (stratSeg, index) => {
      const segmentTrackpoints = trackpoints.slice(
        stratSeg.startTrackpointIndex,
        stratSeg.endTrackpointIndex + 1,
      );
      const distanceKm = calculateTrackDistance(segmentTrackpoints);

      return {
        number: index + 1,
        type: stratSeg.type,
        startTrackpointIndex: stratSeg.startTrackpointIndex,
        endTrackpointIndex: stratSeg.endTrackpointIndex,
        distanceKm,
        detectedBy: [strategyResult.strategy],
        confidenceScore: stratSeg.confidenceScore,
        gpsFiltered: false,
      };
    },
  );

  return { ok: true, value: segments };
}

/**
 * Format a single segment's distance as a string based on type.
 * Swim: rounded to nearest 50m, displayed in metres.
 * Run: rounded to nearest 0.1 km.
 */
export function formatSegmentDistance(segment: Segment): DisplaySegmentPair {
  const swimDistanceM = segment.type === "swim"
    ? String(roundSwimDistance(segment.distanceKm * 1000))
    : "—";
  const runDistanceKm = segment.type === "run"
    ? roundRunDistance(segment.distanceKm).toFixed(1)
    : "—";

  return {
    number: segment.number,
    swimDistanceM,
    runDistanceKm,
    cumulativeKm: null,
    detectedBy: segment.detectedBy.join(" + "),
    confidenceScore: segment.confidenceScore,
  };
}

/**
 * Pair consecutive segments into display rows (ADR-0007).
 *
 * When swimFirst=false (default, "run first"):
 *   Each row shows run N + swim N (run column first, swim column second).
 *   The "primary" type for pairing is "run" — we pair each run with the swim that follows it.
 *
 * When swimFirst=true:
 *   Each row shows swim N + run N (swim column first, run column second).
 *   The "primary" type for pairing is "swim" — we pair each swim with the run that follows it.
 *
 * If the race starts with the "other" type (e.g., starts with swim in run-first mode),
 * the first row will have "—" for the primary column.
 *
 * If the race ends without a secondary segment (e.g., ends with run in run-first mode),
 * the last row will have "—" for the secondary column.
 */
export function pairSegmentsForDisplay(
  segments: Segment[],
  swimFirst: boolean,
): DisplaySegmentPair[] {
  return groupSegmentsForDisplay(segments, swimFirst).map((group, index) => {
    const swim = group.find((segment) => segment.type === "swim");
    const run = group.find((segment) => segment.type === "run");
    return {
      number: index + 1,
      swimDistanceM: swim ? formatSegmentDistance(swim).swimDistanceM : "—",
      runDistanceKm: run ? formatSegmentDistance(run).runDistanceKm : "—",
      cumulativeKm: null,
      detectedBy: [...new Set(group.flatMap((segment) => segment.detectedBy))]
        .join(" + "),
      confidenceScore: Math.min(
        ...group.map((segment) => segment.confidenceScore),
      ),
    };
  });
}

export function groupSegmentsForDisplay(
  segments: Segment[],
  swimFirst: boolean,
): Segment[][] {
  const primary = swimFirst ? "swim" : "run";
  const secondary = swimFirst ? "run" : "swim";
  const groups: Segment[][] = [];
  for (let i = 0; i < segments.length; i++) {
    const group = [segments[i]];
    if (segments[i].type === primary && segments[i + 1]?.type === secondary) {
      group.push(segments[++i]);
    }
    groups.push(group);
  }
  return groups;
}

/**
 * Calculate totals for all segments.
 * Sums all swim distances (in metres) and all run distances (in km) independently,
 * then applies rounding rules.
 */
export function calculateTotals(segments: Segment[]): SegmentTotals {
  let totalSwimM = 0;
  let totalRunKm = 0;

  for (const seg of segments) {
    if (seg.type === "swim") {
      totalSwimM += seg.distanceKm * 1000;
    } else if (seg.type === "run") {
      totalRunKm += seg.distanceKm;
    }
  }

  const roundedSwimM = roundSwimDistance(totalSwimM);
  const roundedRunKm = roundRunDistance(totalRunKm);

  return {
    totalRunKm: roundedRunKm.toFixed(1),
    totalSwimM: String(roundedSwimM),
  };
}
