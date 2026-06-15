import type { Coordinate, Trackpoint } from "./types.ts";

/** Mean Earth radius in kilometres */
export const EARTH_RADIUS_KM = 6371;

/**
 * Calculate the distance between two coordinates using the Haversine formula.
 * Returns the distance in kilometres.
 *
 * @param a First coordinate
 * @param b Second coordinate
 * @returns Distance in kilometres
 */
export function haversineDistance(a: Coordinate, b: Coordinate): number {
  const toRad = (deg: number): number => (deg * Math.PI) / 180;

  const dLat = toRad(b.lat - a.lat);
  const dLon = toRad(b.lon - a.lon);

  const sinHalfLat = Math.sin(dLat / 2);
  const sinHalfLon = Math.sin(dLon / 2);

  const h =
    sinHalfLat * sinHalfLat +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * sinHalfLon * sinHalfLon;

  const c = 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));

  return EARTH_RADIUS_KM * c;
}

/**
 * Calculate the total distance along a track by summing haversine distances
 * between consecutive trackpoints.
 *
 * @param trackpoints Array of trackpoints in order
 * @returns Total distance in kilometres
 */
export function calculateTrackDistance(trackpoints: Trackpoint[]): number {
  if (trackpoints.length < 2) {
    return 0;
  }

  let total = 0;
  for (let i = 1; i < trackpoints.length; i++) {
    total += haversineDistance(
      trackpoints[i - 1].coordinate,
      trackpoints[i].coordinate,
    );
  }
  return total;
}

/**
 * Find the index of the nearest trackpoint to a given coordinate,
 * within a maximum search radius.
 *
 * @param coordinate The reference coordinate to search from
 * @param trackpoints Array of trackpoints to search through
 * @param maxRadiusKm Maximum search radius in kilometres (default: 0.05 km = 50m)
 * @returns Index of the nearest trackpoint, or null if none within radius
 */
export function findNearestTrackpoint(
  coordinate: Coordinate,
  trackpoints: Trackpoint[],
  maxRadiusKm: number = 0.05,
): number | null {
  if (trackpoints.length === 0) {
    return null;
  }

  let nearestIndex: number | null = null;
  let nearestDistance = Infinity;

  for (let i = 0; i < trackpoints.length; i++) {
    const distance = haversineDistance(coordinate, trackpoints[i].coordinate);
    if (distance <= maxRadiusKm && distance < nearestDistance) {
      nearestDistance = distance;
      nearestIndex = i;
    }
  }

  return nearestIndex;
}

/**
 * Calculate the straight-line (great-circle) distance between two coordinates.
 * This is semantically identical to haversineDistance but named to clarify intent
 * when used in GPS filtering contexts (e.g., scatter ratio calculation).
 *
 * @param start Start coordinate
 * @param end End coordinate
 * @returns Distance in kilometres
 */
export function straightLineDistance(
  start: Coordinate,
  end: Coordinate,
): number {
  return haversineDistance(start, end);
}
