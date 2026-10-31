import type { Trackpoint, StrategyResult, StrategySegment } from "../shared/types.ts";
import { haversineDistance } from "../shared/distance-calculator.ts";

export interface SpeedAnalyzerConfig {
  windowSize: number;              // default: 10, min: 3, max: 50
  swimThresholdKph: number;        // default: 5
  minConsecutive: number;          // default: 5
  stationaryThresholdKph: number;  // default: 0.5
}

const DEFAULT_CONFIG: SpeedAnalyzerConfig = {
  windowSize: 10,
  swimThresholdKph: 5,
  minConsecutive: 5,
  stationaryThresholdKph: 0.5,
};

/**
 * Calculate instantaneous speed between two consecutive trackpoints.
 * Returns speed in kph, or null if timestamps are missing or elapsed time is zero.
 */
export function calculateInstantaneousSpeed(
  a: Trackpoint,
  b: Trackpoint,
): number | null {
  if (a.timestamp === null || b.timestamp === null) {
    return null;
  }

  const timeA = new Date(a.timestamp).getTime();
  const timeB = new Date(b.timestamp).getTime();
  const elapsedMs = timeB - timeA;

  if (elapsedMs === 0) {
    return null;
  }

  const distanceKm = haversineDistance(a.coordinate, b.coordinate);
  const elapsedHours = elapsedMs / (1000 * 3600);

  return distanceKm / elapsedHours;
}

/**
 * Apply sliding window average to a speed array.
 * Uses a centered window. Skips null entries when computing the average.
 * Returns null for positions where all values in the window are null.
 */
export function applySlidingWindow(
  speeds: (number | null)[],
  windowSize: number,
): (number | null)[] {
  const result: (number | null)[] = new Array(speeds.length);
  const halfWindow = Math.floor(windowSize / 2);

  for (let i = 0; i < speeds.length; i++) {
    let sum = 0;
    let count = 0;

    const start = Math.max(0, i - halfWindow);
    const end = Math.min(speeds.length - 1, i + halfWindow);

    for (let j = start; j <= end; j++) {
      if (speeds[j] !== null) {
        sum += speeds[j]!;
        count++;
      }
    }

    result[i] = count > 0 ? sum / count : null;
  }

  return result;
}

/**
 * Detect segments from trackpoint speed data.
 * Classifies windowed speeds, finds transitions meeting minConsecutive threshold,
 * and places boundary at midpoint of threshold-crossing sequence.
 */
export function detectBySpeed(
  trackpoints: Trackpoint[],
  config?: Partial<SpeedAnalyzerConfig>,
): StrategyResult {
  const cfg: SpeedAnalyzerConfig = { ...DEFAULT_CONFIG, ...config };

  // Clamp windowSize to valid range
  cfg.windowSize = Math.max(3, Math.min(50, cfg.windowSize));

  if (trackpoints.length < 2) {
    return { strategy: "speed", segments: [] };
  }

  // Step 1: Calculate instantaneous speeds between consecutive trackpoints
  const rawSpeeds: (number | null)[] = [];
  for (let i = 0; i < trackpoints.length; i++) {
    if (i === 0) {
      rawSpeeds.push(null); // No speed for first point
    } else {
      rawSpeeds.push(calculateInstantaneousSpeed(trackpoints[i - 1], trackpoints[i]));
    }
  }

  // If no valid speeds at all, return empty
  if (rawSpeeds.every((s) => s === null)) {
    return { strategy: "speed", segments: [] };
  }

  // Step 2: Apply sliding window
  const windowedSpeeds = applySlidingWindow(rawSpeeds, cfg.windowSize);

  // Step 3: Classify each trackpoint (ignoring stationary)
  type Classification = "swim" | "run" | "stationary" | "unknown";
  const classifications: Classification[] = windowedSpeeds.map((speed) => {
    if (speed === null) return "unknown";
    if (speed < cfg.stationaryThresholdKph) return "stationary";
    if (speed < cfg.swimThresholdKph) return "swim";
    return "run";
  });

  // Step 4: Find transitions with minConsecutive requirement
  // Build runs of consecutive same-type classifications (ignoring stationary/unknown)
  interface Run {
    type: "swim" | "run";
    startIdx: number;
    endIdx: number;
  }

  const runs: Run[] = [];
  let currentType: "swim" | "run" | null = null;
  let currentStart = -1;

  for (let i = 0; i < classifications.length; i++) {
    const cls = classifications[i];
    if (cls === "swim" || cls === "run") {
      if (cls === currentType) {
        // Continue current run
      } else {
        // End previous run if exists
        if (currentType !== null && currentStart >= 0) {
          runs.push({ type: currentType, startIdx: currentStart, endIdx: i - 1 });
        }
        // Start new run
        currentType = cls;
        currentStart = i;
      }
    }
    // stationary/unknown don't break current run but don't extend it either
    // They get absorbed into the current segment
  }
  // Close final run
  if (currentType !== null && currentStart >= 0) {
    runs.push({ type: currentType, startIdx: currentStart, endIdx: classifications.length - 1 });
  }

  if (runs.length === 0) {
    return { strategy: "speed", segments: [] };
  }

  // Step 5: Filter runs that don't meet minConsecutive
  // Count only non-stationary/non-unknown points in a run
  const confirmedRuns: Run[] = [];
  for (const run of runs) {
    let activeCount = 0;
    for (let i = run.startIdx; i <= run.endIdx; i++) {
      if (classifications[i] === run.type) {
        activeCount++;
      }
    }
    if (activeCount >= cfg.minConsecutive) {
      confirmedRuns.push(run);
    }
  }

  if (confirmedRuns.length === 0) {
    // If no runs meet minConsecutive, classify the whole track by the most common type
    let swimCount = 0;
    let runCount = 0;
    for (const cls of classifications) {
      if (cls === "swim") swimCount++;
      if (cls === "run") runCount++;
    }
    const dominantType = swimCount > runCount ? "swim" : "run";
    const segments: StrategySegment[] = [{
      type: dominantType,
      startTrackpointIndex: 0,
      endTrackpointIndex: trackpoints.length - 1,
      confidenceScore: 0.3, // Low confidence when no clear transitions
    }];
    return { strategy: "speed", segments };
  }

  // Step 6: Build segments from confirmed runs, placing boundaries at midpoints
  const segments: StrategySegment[] = [];

  for (let i = 0; i < confirmedRuns.length; i++) {
    const run = confirmedRuns[i];
    let segStart: number;
    let segEnd: number;

    if (i === 0) {
      // First segment starts at track beginning
      segStart = 0;
    } else {
      // Place boundary at midpoint between previous run end and this run start
      const prevEnd = confirmedRuns[i - 1].endIdx;
      const gap = run.startIdx - prevEnd;
      segStart = prevEnd + Math.floor(gap / 2) + 1;
    }

    if (i === confirmedRuns.length - 1) {
      // Last segment ends at track end
      segEnd = trackpoints.length - 1;
    } else {
      // Place boundary at midpoint between this run end and next run start
      const nextStart = confirmedRuns[i + 1].startIdx;
      const gap = nextStart - run.endIdx;
      segEnd = run.endIdx + Math.floor(gap / 2);
    }

    // Calculate confidence for this segment
    let confidence: number;
    if (i === 0 && confirmedRuns.length === 1) {
      // Single segment - calculate from mean speed vs threshold
      let sum = 0;
      let count = 0;
      for (let j = segStart; j <= segEnd; j++) {
        if (windowedSpeeds[j] !== null) {
          sum += windowedSpeeds[j]!;
          count++;
        }
      }
      const meanSpeed = count > 0 ? sum / count : 0;
      if (run.type === "swim") {
        confidence = calculateSpeedConfidence(meanSpeed, cfg.swimThresholdKph + 3);
      } else {
        confidence = calculateSpeedConfidence(meanSpeed, cfg.swimThresholdKph - 3);
      }
    } else {
      // Multi-segment: confidence from speed difference at boundary
      const meanBefore = getMeanSpeed(windowedSpeeds, segStart, segEnd);
      if (i < confirmedRuns.length - 1) {
        const nextRun = confirmedRuns[i + 1];
        const meanAfter = getMeanSpeed(windowedSpeeds, nextRun.startIdx, nextRun.endIdx);
        confidence = calculateSpeedConfidence(meanBefore, meanAfter);
      } else if (i > 0) {
        const prevRun = confirmedRuns[i - 1];
        const meanPrev = getMeanSpeed(windowedSpeeds, prevRun.startIdx, prevRun.endIdx);
        confidence = calculateSpeedConfidence(meanPrev, meanBefore);
      } else {
        confidence = 0.5;
      }
      // A segment far from the swim/run threshold is trustworthy even next to a similar neighbour.
      confidence = Math.max(
        confidence,
        Math.abs(meanBefore - cfg.swimThresholdKph) / cfg.swimThresholdKph,
      );
    }

    segments.push({
      type: run.type,
      startTrackpointIndex: segStart,
      endTrackpointIndex: segEnd,
      confidenceScore: Math.min(1.0, Math.max(0, confidence)),
    });
  }

  // Step 7: Handle track start/end with fewer than minConsecutive readings
  // If the first confirmed run doesn't start at 0, the beginning inherits
  // from the nearest adjacent segment (the first confirmed segment).
  // This is already handled by step 6: we set segStart=0 for the first segment.

  return { strategy: "speed", segments };
}

/**
 * Calculate confidence score for a speed transition.
 * |meanBefore - meanAfter| / 10, capped at 1.0.
 */
export function calculateSpeedConfidence(
  meanBefore: number,
  meanAfter: number,
): number {
  return Math.min(1.0, Math.abs(meanBefore - meanAfter) / 10);
}

/**
 * Check if speed-based detection is available.
 * Returns true if there are at least 2 consecutive trackpoints with valid timestamps.
 */
export function isSpeedDetectionAvailable(trackpoints: Trackpoint[]): boolean {
  for (let i = 0; i < trackpoints.length - 1; i++) {
    if (trackpoints[i].timestamp !== null && trackpoints[i + 1].timestamp !== null) {
      return true;
    }
  }
  return false;
}

// --- Internal helpers ---

function getMeanSpeed(
  windowedSpeeds: (number | null)[],
  start: number,
  end: number,
): number {
  let sum = 0;
  let count = 0;
  for (let i = start; i <= end; i++) {
    if (windowedSpeeds[i] !== null) {
      sum += windowedSpeeds[i]!;
      count++;
    }
  }
  return count > 0 ? sum / count : 0;
}
