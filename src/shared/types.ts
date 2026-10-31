/** Geographic coordinate with latitude and longitude */
export interface Coordinate {
  lat: number; // -90 to 90
  lon: number; // -180 to 180
}

/** Parsed GPX waypoint */
export interface Waypoint {
  coordinate: Coordinate;
  elevation: number;
  name: string;
  symbol: string;
  description: string;
}

/** Parsed GPX trackpoint */
export interface Trackpoint {
  coordinate: Coordinate;
  elevation: number;
  timestamp: string | null; // ISO 8601 or null if missing
  index: number; // position in original track
}

/** Parsed GPX track */
export interface Track {
  name: string;
  trackpoints: Trackpoint[];
}

/** Full parsed GPX data */
export interface GPXData {
  waypoints: Waypoint[];
  tracks: Track[];
}

/** Waypoint classification types */
export type WaypointType = "swim-start" | "swim-end" | "aid-station" | "other";

/** A waypoint with its classification */
export interface ClassifiedWaypoint {
  waypoint: Waypoint;
  type: WaypointType;
}

/** Segment type */
export type SegmentType = "swim" | "run" | "unclassified";

/** Detection strategy identifier */
export type StrategyName = "waypoint" | "speed" | "landscape";

/** A race segment with calculated distance */
export interface Segment {
  number: number;
  type: SegmentType;
  startTrackpointIndex: number;
  endTrackpointIndex: number;
  distanceKm: number;
  detectedBy: StrategyName[];
  confidenceScore: number; // 0.0 to 1.0
  gpsFiltered: boolean;
}

/** Strategy detection result for a track region */
export interface StrategyResult {
  strategy: StrategyName;
  segments: StrategySegment[];
}

/** A segment as detected by a single strategy */
export interface StrategySegment {
  type: SegmentType;
  startTrackpointIndex: number;
  endTrackpointIndex: number;
  confidenceScore: number;
}

/** Terrain type at a coordinate */
export type TerrainType = "water" | "land" | "unknown";

/** Terrain lookup result for a single coordinate */
export interface TerrainResult {
  coordinate: Coordinate;
  terrainType: TerrainType;
  hasRoadData: boolean;
}

/** GPS filter classification */
export interface FilterResult {
  scatterRatio: number;
  hasSignificantNoise: boolean;
  filterMethod: "none" | "straight-line" | "smoothed";
  filteredDistance: number;
  originalDistance: number;
}

/** Formatted segment pair for display (ADR-0007: paired-row, no empty cells) */
export interface DisplaySegmentPair {
  number: number;
  swimDistanceM: string; // rounded to nearest 50m, or "—" if absent
  runDistanceKm: string; // rounded to nearest 0.1 km, or "—" if absent
  cumulativeKm: string | null; // optional cumulative column
  detectedBy: string;
  confidenceScore: number;
}

/** Segment totals */
export interface SegmentTotals {
  totalRunKm: string;
  totalSwimM: string;
}

/** Aid station with position metadata */
export interface AidStation {
  waypoint: Waypoint;
  positionNumber: number;
  totalAidStations: number;
}

/** Validation result */
export interface ValidationResult {
  valid: boolean;
  error?: string;
}

/** Result type for operations that can fail */
export type Result<T> =
  | { ok: true; value: T }
  | { ok: false; error: string };
