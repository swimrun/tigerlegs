import type { GPXData, Segment, SegmentTotals, StrategyResult } from "../shared/types.ts";
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
    results.push(detectBySpeed(trackpoints));
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
