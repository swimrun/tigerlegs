import type { Coordinate, FilterResult, Trackpoint } from "../shared/types.ts";
import {
  calculateTrackDistance,
  haversineDistance,
  straightLineDistance,
} from "../shared/distance-calculator.ts";

export interface GPSFilterConfig {
  scatterThreshold: number; // ratio above which = noisy (default: 1.5)
  deviationThreshold: number; // metres, lateral deviation (default: 20)
  consecutiveDeviations: number; // count for curve detection (default: 4)
  smoothingWindow: number; // moving average window (default: 5)
  maxSmoothedRatio: number; // max smoothed/straight ratio (default: 1.2)
  minStraightLineDistance: number; // metres, below which skip filtering (default: 5)
}

const DEFAULT_CONFIG: GPSFilterConfig = {
  scatterThreshold: 1.5,
  deviationThreshold: 20,
  consecutiveDeviations: 4,
  smoothingWindow: 5,
  maxSmoothedRatio: 1.2,
  minStraightLineDistance: 5,
};

/**
 * Compute scatter ratio for a swim segment.
 * Defined as cumulative trackpoint-to-trackpoint distance divided by
 * straight-line distance between segment start and end.
 * Returns Infinity if straight-line distance is 0.
 */
export function computeScatterRatio(
  trackpoints: Trackpoint[],
  startIndex: number,
  endIndex: number,
): number {
  const segmentPoints = trackpoints.slice(startIndex, endIndex + 1);

  if (segmentPoints.length < 2) {
    return Infinity;
  }

  const cumulative = calculateTrackDistance(segmentPoints);
  const straight = straightLineDistance(
    segmentPoints[0].coordinate,
    segmentPoints[segmentPoints.length - 1].coordinate,
  );

  if (straight === 0) {
    return Infinity;
  }

  return cumulative / straight;
}

/**
 * Compute the perpendicular distance from a point to the line defined by
 * start and end coordinates. Returns distance in metres and the sign
 * indicates which side of the line (positive = one side, negative = other).
 */
function perpendicularDistanceSigned(
  point: Coordinate,
  lineStart: Coordinate,
  lineEnd: Coordinate,
): number {
  // Use a simple 2D cross-product approximation on lat/lon.
  // Convert to approximate metres using latitude correction.
  const cosLat = Math.cos((lineStart.lat * Math.PI) / 180);

  // Vector from start to end
  const dx = (lineEnd.lon - lineStart.lon) * cosLat;
  const dy = lineEnd.lat - lineStart.lat;

  // Vector from start to point
  const px = (point.lon - lineStart.lon) * cosLat;
  const py = point.lat - lineStart.lat;

  // Line length in degree-metres
  const lineLen = Math.sqrt(dx * dx + dy * dy);
  if (lineLen === 0) {
    // Start and end are same point, distance is just haversine from point to start
    return haversineDistance(point, lineStart) * 1000;
  }

  // Cross product gives signed perpendicular distance (in degrees, roughly)
  const cross = px * dy - py * dx;

  // Convert from degree-units to approximate metres
  // 1 degree of latitude ≈ 111,320 metres
  const signedDistDeg = cross / lineLen;
  const signedDistMetres = signedDistDeg * 111320;

  return signedDistMetres;
}

/**
 * Determine if consecutive trackpoints deviate laterally from the
 * straight line connecting start to end.
 * Counts max consecutive points exceeding threshold in the same lateral direction.
 */
export function detectLateralDeviation(
  trackpoints: Trackpoint[],
  startIndex: number,
  endIndex: number,
  thresholdMetres: number,
): { hasConsecutiveDeviation: boolean; maxConsecutive: number } {
  const segmentPoints = trackpoints.slice(startIndex, endIndex + 1);

  if (segmentPoints.length < 3) {
    return { hasConsecutiveDeviation: false, maxConsecutive: 0 };
  }

  const lineStart = segmentPoints[0].coordinate;
  const lineEnd = segmentPoints[segmentPoints.length - 1].coordinate;

  let maxConsecutive = 0;
  let currentConsecutive = 0;
  let lastSign: number | null = null;

  // Check intermediate points (skip first and last which define the line)
  for (let i = 1; i < segmentPoints.length - 1; i++) {
    const signedDist = perpendicularDistanceSigned(
      segmentPoints[i].coordinate,
      lineStart,
      lineEnd,
    );
    const absDist = Math.abs(signedDist);
    const sign = signedDist >= 0 ? 1 : -1;

    if (absDist > thresholdMetres) {
      if (lastSign === sign) {
        currentConsecutive++;
      } else {
        currentConsecutive = 1;
        lastSign = sign;
      }
      maxConsecutive = Math.max(maxConsecutive, currentConsecutive);
    } else {
      currentConsecutive = 0;
      lastSign = null;
    }
  }

  return {
    hasConsecutiveDeviation: maxConsecutive >= 4,
    maxConsecutive,
  };
}

/**
 * Apply moving-average smoothing to a trackpoint path.
 * Averages lat/lon independently within the window (centered).
 * Never mutates the input array.
 */
export function smoothPath(
  trackpoints: Trackpoint[],
  windowSize: number,
): Coordinate[] {
  const result: Coordinate[] = [];
  const halfWindow = Math.floor(windowSize / 2);

  for (let i = 0; i < trackpoints.length; i++) {
    const start = Math.max(0, i - halfWindow);
    const end = Math.min(trackpoints.length - 1, i + halfWindow);
    let sumLat = 0;
    let sumLon = 0;
    let count = 0;

    for (let j = start; j <= end; j++) {
      sumLat += trackpoints[j].coordinate.lat;
      sumLon += trackpoints[j].coordinate.lon;
      count++;
    }

    result.push({
      lat: sumLat / count,
      lon: sumLon / count,
    });
  }

  return result;
}

/**
 * Calculate the total distance along a path of coordinates.
 */
function coordinatePathDistance(coordinates: Coordinate[]): number {
  if (coordinates.length < 2) return 0;
  let total = 0;
  for (let i = 1; i < coordinates.length; i++) {
    total += haversineDistance(coordinates[i - 1], coordinates[i]);
  }
  return total;
}

/**
 * Apply GPS noise filtering to a swim segment.
 * Returns FilterResult with scatter ratio, filter method, and distances.
 * Never mutates the input trackpoints array.
 *
 * Algorithm:
 * 1. If straight-line distance < minStraightLineDistance: return unfiltered
 * 2. Compute scatter ratio
 * 3. If scatter ≤ scatterThreshold: no noise, use cumulative distance
 * 4. If noisy and maxConsecutive < consecutiveDeviations: straight-line replacement
 * 5. If noisy and maxConsecutive ≥ consecutiveDeviations: apply smoothing, cap at maxSmoothedRatio of straight-line
 */
export function filterSwimSegment(
  trackpoints: Trackpoint[],
  startIndex: number,
  endIndex: number,
  config?: Partial<GPSFilterConfig>,
): FilterResult {
  const cfg: GPSFilterConfig = { ...DEFAULT_CONFIG, ...config };

  const segmentPoints = trackpoints.slice(startIndex, endIndex + 1);

  // Calculate original cumulative distance
  const originalDistance = calculateTrackDistance(segmentPoints);

  // Check straight-line distance
  const straight = segmentPoints.length >= 2
    ? straightLineDistance(
      segmentPoints[0].coordinate,
      segmentPoints[segmentPoints.length - 1].coordinate,
    )
    : 0;

  // Convert minStraightLineDistance from metres to km for comparison
  const minStraightKm = cfg.minStraightLineDistance / 1000;

  // Step 1: If straight-line distance < threshold, skip filtering
  if (straight < minStraightKm) {
    return {
      scatterRatio: straight === 0 ? Infinity : originalDistance / straight,
      hasSignificantNoise: false,
      filterMethod: "none",
      filteredDistance: originalDistance,
      originalDistance,
    };
  }

  // Step 2: Compute scatter ratio
  const scatterRatio = originalDistance / straight;

  // Step 3: If scatter ≤ threshold, no noise
  if (scatterRatio <= cfg.scatterThreshold) {
    return {
      scatterRatio,
      hasSignificantNoise: false,
      filterMethod: "none",
      filteredDistance: originalDistance,
      originalDistance,
    };
  }

  // Step 4: Segment has significant noise — determine method
  const { maxConsecutive } = detectLateralDeviation(
    trackpoints,
    startIndex,
    endIndex,
    cfg.deviationThreshold,
  );

  if (maxConsecutive < cfg.consecutiveDeviations) {
    // Straight-line replacement
    return {
      scatterRatio,
      hasSignificantNoise: true,
      filterMethod: "straight-line",
      filteredDistance: straight,
      originalDistance,
    };
  }

  // Step 5: Apply smoothing, cap at maxSmoothedRatio of straight-line
  const smoothed = smoothPath(segmentPoints, cfg.smoothingWindow);
  let smoothedDistance = coordinatePathDistance(smoothed);
  const maxAllowed = straight * cfg.maxSmoothedRatio;

  if (smoothedDistance > maxAllowed) {
    smoothedDistance = maxAllowed;
  }

  return {
    scatterRatio,
    hasSignificantNoise: true,
    filterMethod: "smoothed",
    filteredDistance: smoothedDistance,
    originalDistance,
  };
}
