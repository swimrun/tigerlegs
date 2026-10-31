import type { GPXData, Segment, SegmentTotals, StrategyResult, Trackpoint } from "../shared/types.ts";
import { calculateTrackDistance } from "../shared/distance-calculator.ts";
import { detectBySpeed } from "./speed-analyzer.ts";
import { detectByWaypoint } from "./waypoint-classifier.ts";
import {
  combineStrategies,
  detectApplicableStrategies,
} from "./strategy-combiner.ts";
import { calculateTotals } from "./segment-builder.ts";

export interface Analysis {
  trackName: string;
  segments: Segment[];
  totals: SegmentTotals;
  strategies: string[];
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
 * Analyse parsed GPX data using the strategies that need no network access
 * (waypoint and speed). The landscape strategy requires the terrain API and
 * is not used here.
 */
export function analyzeGpx(gpx: GPXData): Analysis {
  const track = gpx.tracks.find((t) => t.trackpoints.length > 0) ?? gpx.tracks[0];
  const trackpoints = track.trackpoints;
  const applicable = detectApplicableStrategies(gpx);
  const results: StrategyResult[] = [];

  if (applicable.includes("waypoint")) {
    results.push(detectByWaypoint(gpx.waypoints, trackpoints));
  }
  if (applicable.includes("speed")) {
    // Smooth over a fixed time span so 1 s recordings do not flicker between swim and run.
    const dt = medianSampleSeconds(trackpoints) ?? 1;
    const points = Math.max(3, Math.min(50, Math.round(SMOOTHING_SECONDS / dt)));
    results.push(detectBySpeed(trackpoints, {
      windowSize: points,
      minConsecutive: points,
      swimThresholdKph: SWIM_THRESHOLD_KPH,
    }));
  }

  const segments = combineStrategies(results, trackpoints.length).map((seg, i, all) => {
    // Include the step to the next segment's first point so distances add up.
    const end = i < all.length - 1 ? seg.endTrackpointIndex + 2 : seg.endTrackpointIndex + 1;
    return {
      ...seg,
      distanceKm: calculateTrackDistance(trackpoints.slice(seg.startTrackpointIndex, end)),
    };
  });

  return {
    trackName: track.name,
    segments,
    totals: calculateTotals(segments),
    strategies: results.map((r) => r.strategy),
  };
}
