import type {
  GPXData,
  Segment,
  SegmentTotals,
  StrategyName,
  StrategyResult,
  Trackpoint,
} from "../shared/types.ts";
import { calculateTrackDistance } from "../shared/distance-calculator.ts";
import { detectBySpeed } from "./speed-analyzer.ts";
import { detectByWaypoint } from "./waypoint-classifier.ts";
import {
  combineStrategies,
  type ConflictInfo,
  detectApplicableStrategies,
  detectConflicts,
} from "./strategy-combiner.ts";
import { calculateTotals } from "./segment-builder.ts";
import { cleanSegments } from "./segment-cleaner.ts";
import { detectByWater, type WaterBody } from "./water.ts";
import { detectRestSpans, splitAtRests } from "./rest-detector.ts";

export interface Analysis {
  trackName: string;
  segments: Segment[];
  totals: SegmentTotals;
  strategies: string[];
  conflicts: ConflictInfo[];
}

const SMOOTHING_SECONDS = 40;
const SWIM_THRESHOLD_KPH = 4.5;

// Median seconds between trackpoints, or null when timestamps are missing.
function medianSampleSeconds(points: Trackpoint[]): number | null {
  const dts: number[] = [];
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1].timestamp, b = points[i].timestamp;
    if (!a || !b) continue;
    const dt = (Date.parse(b) - Date.parse(a)) / 1000;
    if (dt > 0) dts.push(dt);
  }
  if (dts.length === 0) return null;
  dts.sort((x, y) => x - y);
  return dts[Math.floor(dts.length / 2)];
}

/**
 * Analyse parsed GPX data with the waypoint and speed strategies. When OpenStreetMap
 * water bodies are supplied (fetched in the browser), the landscape strategy joins in.
 */
export interface AnalysisOptions {
  trackIndex?: number;
  enabledStrategies?: readonly StrategyName[];
}

export function analyzeGpx(
  gpx: GPXData,
  water: WaterBody[] = [],
  options: AnalysisOptions = {},
): Analysis {
  const track = options.trackIndex === undefined
    ? gpx.tracks.find((t) => t.trackpoints.length > 0)
    : gpx.tracks[options.trackIndex];
  if (!track || track.trackpoints.length === 0) {
    throw new RangeError("Select a track containing trackpoints");
  }
  const trackpoints = track.trackpoints;
  const applicable = detectApplicableStrategies({
    waypoints: gpx.waypoints,
    tracks: [track],
  })
    .filter((strategy) =>
      options.enabledStrategies?.includes(strategy) ?? true
    );
  const results: StrategyResult[] = [];

  if (applicable.includes("waypoint")) {
    results.push(detectByWaypoint(gpx.waypoints, trackpoints));
  }
  if (applicable.includes("speed")) {
    // Smooth over a fixed time span so 1 s recordings do not flicker between swim and run.
    const dt = medianSampleSeconds(trackpoints) ?? 1;
    const points = Math.max(
      3,
      Math.min(50, Math.round(SMOOTHING_SECONDS / dt)),
    );
    results.push(detectBySpeed(trackpoints, {
      windowSize: points,
      minConsecutive: points,
      swimThresholdKph: SWIM_THRESHOLD_KPH,
    }));
  }

  if (applicable.includes("landscape") && water.length > 0) {
    results.push(detectByWater(trackpoints, water));
  }

  const combined = combineStrategies(results, trackpoints.length);
  const rests = applicable.includes("speed") ? detectRestSpans(trackpoints) : [];
  const withDistances = splitAtRests(combined, rests, trackpoints).map(
    (seg, i, all) => {
      // Include the step to the next segment's first point so distances add up.
      const end = i < all.length - 1
        ? seg.endTrackpointIndex + 2
        : seg.endTrackpointIndex + 1;
      return {
        ...seg,
        distanceKm: calculateTrackDistance(
          trackpoints.slice(seg.startTrackpointIndex, end),
        ),
      };
    },
  );

  const segments = cleanSegments(withDistances);

  return {
    trackName: track.name,
    segments,
    totals: calculateTotals(segments),
    strategies: results.map((r) => r.strategy),
    conflicts: detectConflicts(results, trackpoints),
  };
}
