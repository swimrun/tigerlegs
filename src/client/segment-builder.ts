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
  return Math.round(km * 10) / 10;
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
  if (segments.length === 0) return [];

  const primaryType = swimFirst ? "swim" : "run";
  const secondaryType = swimFirst ? "run" : "swim";
  const pairs: DisplaySegmentPair[] = [];

  let i = 0;
  let pairNumber = 1;

  // If the first segment is the secondary type (e.g., swim in run-first mode),
  // create a row with "—" for the primary type
  if (segments[0].type === secondaryType) {
    const secondary = segments[0];
    const swimDist = secondary.type === "swim"
      ? String(roundSwimDistance(secondary.distanceKm * 1000))
      : "—";
    const runDist = secondary.type === "run"
      ? roundRunDistance(secondary.distanceKm).toFixed(1)
      : "—";

    pairs.push({
      number: pairNumber++,
      swimDistanceM: swimDist,
      runDistanceKm: runDist,
      cumulativeKm: null,
      detectedBy: secondary.detectedBy.join(" + "),
      confidenceScore: secondary.confidenceScore,
    });
    i = 1;
  }

  // Process remaining segments in pairs
  while (i < segments.length) {
    const primary = segments[i];
    const secondary = i + 1 < segments.length ? segments[i + 1] : null;

    let swimDist: string;
    let runDist: string;
    let detectedBy: string;
    let confidence: number;

    if (primaryType === "run") {
      // Primary is run
      runDist = roundRunDistance(primary.distanceKm).toFixed(1);
      if (secondary && secondary.type === "swim") {
        swimDist = String(roundSwimDistance(secondary.distanceKm * 1000));
        detectedBy = [...new Set([
          ...primary.detectedBy,
          ...secondary.detectedBy,
        ])].join(" + ");
        confidence = Math.min(
          primary.confidenceScore,
          secondary.confidenceScore,
        );
        i += 2;
      } else {
        swimDist = "—";
        detectedBy = primary.detectedBy.join(" + ");
        confidence = primary.confidenceScore;
        i += 1;
      }
    } else {
      // Primary is swim
      swimDist = String(roundSwimDistance(primary.distanceKm * 1000));
      if (secondary && secondary.type === "run") {
        runDist = roundRunDistance(secondary.distanceKm).toFixed(1);
        detectedBy = [...new Set([
          ...primary.detectedBy,
          ...secondary.detectedBy,
        ])].join(" + ");
        confidence = Math.min(
          primary.confidenceScore,
          secondary.confidenceScore,
        );
        i += 2;
      } else {
        runDist = "—";
        detectedBy = primary.detectedBy.join(" + ");
        confidence = primary.confidenceScore;
        i += 1;
      }
    }

    pairs.push({
      number: pairNumber++,
      swimDistanceM: swimDist,
      runDistanceKm: runDist,
      cumulativeKm: null,
      detectedBy,
      confidenceScore: confidence,
    });
  }

  return pairs;
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
