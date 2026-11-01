import { parseGPX } from "./gpx-parser.ts";
import { type Analysis, type AnalysisOptions, analyzeGpx } from "./analyze.ts";
import type { GPXData, Result } from "../shared/types.ts";
import type { WaterBody } from "./water.ts";

export const WORKER_TRACKPOINT_THRESHOLD = 10000;
export const CONFIRM_TRACKPOINT_THRESHOLD = 50000;
export const WARN_WAYPOINT_THRESHOLD = 100;

export type AnalysisJob =
  | { kind: "parse"; xml: string }
  | {
    kind: "analyze";
    gpx: GPXData;
    water: WaterBody[];
    options: AnalysisOptions;
  };

export type AnalysisReply =
  | { kind: "parse"; result: Result<GPXData> }
  | { kind: "analyze"; result: Result<Analysis> };

export function processAnalysisJob(job: AnalysisJob): AnalysisReply {
  if (job.kind === "parse") return { kind: "parse", result: parseGPX(job.xml) };
  try {
    return {
      kind: "analyze",
      result: { ok: true, value: analyzeGpx(job.gpx, job.water, job.options) },
    };
  } catch (error) {
    return {
      kind: "analyze",
      result: {
        ok: false,
        error: error instanceof Error ? error.message : String(error),
      },
    };
  }
}

export function filePointCounts(gpx: GPXData) {
  return {
    trackpoints: gpx.tracks.reduce(
      (sum, track) => sum + track.trackpoints.length,
      0,
    ),
    waypoints: gpx.waypoints.length,
  };
}

export function importWarnings(gpx: GPXData) {
  const counts = filePointCounts(gpx);
  return {
    ...counts,
    confirmationRequired: counts.trackpoints > CONFIRM_TRACKPOINT_THRESHOLD,
    manyWaypoints: counts.waypoints > WARN_WAYPOINT_THRESHOLD,
    trackSelectionRequired: gpx.tracks.length > 1,
  };
}

export function requiresAnalysisWorker(pointCount: number): boolean {
  return pointCount > WORKER_TRACKPOINT_THRESHOLD;
}
