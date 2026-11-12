import type { Coordinate, TerrainResult } from "../shared/types.ts";
import type { CacheStore } from "./cache.ts";
import { coordinateCacheKey } from "./cache.ts";
import { haversineDistance } from "../shared/distance-calculator.ts";

// --- Types ---

export interface CorridorFeatures {
  waterPolygons: GeoPolygon[];
  roads: GeoLineString[];
  paths: GeoLineString[];
}

export interface GeoPolygon {
  coordinates: Coordinate[];
  tags: Record<string, string>;
}

export interface GeoLineString {
  coordinates: Coordinate[];
  tags: Record<string, string>;
}

// --- Constants ---

/** Water features rarely change — cache for 7 days */
const WATER_TTL_SECONDS = 604800;

/** Road/path features may change more often — cache for 72 hours */
const ROAD_TTL_SECONDS = 259200;

/** Default corridor width in metres for the Overpass around query */
const DEFAULT_CORRIDOR_WIDTH_METRES = 30;

/** Threshold in km for "within 10m of road" classification */
const ROAD_PROXIMITY_KM = 0.010; // 10 metres

/** Path highway types that classify as paths rather than roads */
const PATH_TYPES = new Set(["path", "track", "footway", "bridleway", "cycleway"]);

// --- Overpass API configuration ---

function getOverpassApiUrl(): string {
  return process.env.OVERPASS_API_URL ?? "https://overpass-api.de/api/interpreter";
}

// --- Point-in-polygon (ray casting algorithm) ---

/**
 * Determine if a point is inside a polygon using the ray casting algorithm.
 * A ray is cast from the point to the right (+lon direction). If it crosses
 * the polygon boundary an odd number of times, the point is inside.
 */
export function pointInPolygon(point: Coordinate, polygon: Coordinate[]): boolean {
  const n = polygon.length;
  if (n < 3) return false;

  let inside = false;
  const px = point.lon;
  const py = point.lat;

  for (let i = 0, j = n - 1; i < n; j = i++) {
    const xi = polygon[i].lon;
    const yi = polygon[i].lat;
    const xj = polygon[j].lon;
    const yj = polygon[j].lat;

    // Check if the ray from (px, py) going in +x direction crosses edge (i, j)
    const intersect =
      ((yi > py) !== (yj > py)) &&
      (px < (xj - xi) * (py - yi) / (yj - yi) + xi);

    if (intersect) {
      inside = !inside;
    }
  }

  return inside;
}

// --- Distance from point to line segment ---

/**
 * Calculate the minimum distance from a point to a line segment (in km).
 * Uses perpendicular distance if the projection falls on the segment,
 * otherwise uses distance to the nearest endpoint.
 */
function distanceToSegment(point: Coordinate, segStart: Coordinate, segEnd: Coordinate): number {
  // Use a simple approximation: project point onto line in cartesian coords
  // then verify with haversine for the final distance
  const dx = segEnd.lon - segStart.lon;
  const dy = segEnd.lat - segStart.lat;
  const lenSq = dx * dx + dy * dy;

  if (lenSq === 0) {
    // Segment is a point
    return haversineDistance(point, segStart);
  }

  // Parameter t of the projection of point onto the line
  let t = ((point.lon - segStart.lon) * dx + (point.lat - segStart.lat) * dy) / lenSq;
  t = Math.max(0, Math.min(1, t));

  const projection: Coordinate = {
    lat: segStart.lat + t * dy,
    lon: segStart.lon + t * dx,
  };

  return haversineDistance(point, projection);
}

/**
 * Calculate the minimum distance from a point to a polyline (in km).
 */
function distanceToPolyline(point: Coordinate, line: Coordinate[]): number {
  let minDist = Infinity;
  for (let i = 0; i < line.length - 1; i++) {
    const dist = distanceToSegment(point, line[i], line[i + 1]);
    if (dist < minDist) {
      minDist = dist;
    }
  }
  return minDist;
}

// --- Overpass QL query building ---

/**
 * Build an Overpass QL query for fetching corridor features.
 */
function buildOverpassQuery(coordinates: Coordinate[], corridorWidth: number): string {
  // Build the coordinate list for the around statement
  const coordList = coordinates.map((c) => `${c.lat},${c.lon}`).join(",");

  return `[out:json][timeout:30];
(
  way["natural"="water"](around:${corridorWidth},${coordList});
  way["waterway"~"riverbank|dock|canal"](around:${corridorWidth},${coordList});
  relation["natural"="water"](around:${corridorWidth},${coordList});
  way["highway"](around:${corridorWidth},${coordList});
);
out geom;`;
}

// --- Overpass response parsing ---

interface OverpassElement {
  type: "node" | "way" | "relation";
  id: number;
  tags?: Record<string, string>;
  geometry?: Array<{ lat: number; lon: number }>;
  members?: Array<{
    type: string;
    role: string;
    geometry?: Array<{ lat: number; lon: number }>;
  }>;
}

interface OverpassResponse {
  elements: OverpassElement[];
}

/**
 * Determine if an element is a water feature based on its tags.
 */
function isWaterFeature(tags: Record<string, string>): boolean {
  if (tags.natural === "water") return true;
  const waterway = tags.waterway;
  if (waterway === "riverbank" || waterway === "dock" || waterway === "canal") return true;
  return false;
}

/**
 * Determine if an element is a road feature based on its tags.
 */
function isRoadFeature(tags: Record<string, string>): boolean {
  return "highway" in tags;
}

/**
 * Parse Overpass response elements into CorridorFeatures.
 */
function parseOverpassResponse(response: OverpassResponse): CorridorFeatures {
  const waterPolygons: GeoPolygon[] = [];
  const roads: GeoLineString[] = [];
  const paths: GeoLineString[] = [];

  for (const element of response.elements) {
    const tags = element.tags ?? {};

    if (element.type === "way") {
      const coords = (element.geometry ?? []).map((g) => ({
        lat: g.lat,
        lon: g.lon,
      }));

      if (isWaterFeature(tags) && coords.length >= 3) {
        waterPolygons.push({ coordinates: coords, tags });
      } else if (isRoadFeature(tags) && coords.length >= 2) {
        const highwayType = tags.highway;
        if (PATH_TYPES.has(highwayType)) {
          paths.push({ coordinates: coords, tags });
        } else {
          roads.push({ coordinates: coords, tags });
        }
      }
    } else if (element.type === "relation") {
      // Handle multipolygon relations (water bodies)
      if (isWaterFeature(tags) && element.members) {
        for (const member of element.members) {
          if (member.role === "outer" && member.geometry && member.geometry.length >= 3) {
            const coords = member.geometry.map((g) => ({
              lat: g.lat,
              lon: g.lon,
            }));
            waterPolygons.push({ coordinates: coords, tags });
          }
        }
      }
    }
  }

  return { waterPolygons, roads, paths };
}

// --- Public API ---

/**
 * Fetch all water polygons and road/path features along a track corridor.
 * Uses a single Overpass query with the "around" statement to get all
 * relevant features in one API call.
 */
export async function fetchTrackCorridor(
  coordinates: Coordinate[],
  corridorWidthMetres: number = DEFAULT_CORRIDOR_WIDTH_METRES,
): Promise<CorridorFeatures> {
  const query = buildOverpassQuery(coordinates, corridorWidthMetres);
  const apiUrl = getOverpassApiUrl();

  const response = await fetch(apiUrl, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: `data=${encodeURIComponent(query)}`,
  });

  if (!response.ok) {
    throw new Error(
      `Overpass API error: ${response.status} ${response.statusText}`,
    );
  }

  const data = await response.json() as OverpassResponse;
  return parseOverpassResponse(data);
}

/**
 * Perform point-in-polygon tests to classify each coordinate
 * as water or land based on the fetched corridor features.
 *
 * Classification priority:
 * 1. If inside any water polygon → "water"
 * 2. If within 10m of a highway=* feature → "land" with hasRoadData=true
 * 3. Otherwise → "land" (default)
 */
export function classifyCoordinates(
  coordinates: Coordinate[],
  corridor: CorridorFeatures,
): TerrainResult[] {
  return coordinates.map((coord) => {
    // Check water polygons first
    for (const polygon of corridor.waterPolygons) {
      if (pointInPolygon(coord, polygon.coordinates)) {
        return {
          coordinate: coord,
          terrainType: "water" as const,
          hasRoadData: false,
        };
      }
    }

    // Check road proximity (within 10m)
    const allRoadFeatures = [...corridor.roads, ...corridor.paths];
    for (const road of allRoadFeatures) {
      const dist = distanceToPolyline(coord, road.coordinates);
      if (dist <= ROAD_PROXIMITY_KM) {
        return {
          coordinate: coord,
          terrainType: "land" as const,
          hasRoadData: true,
        };
      }
    }

    // Default: land without road data
    return {
      coordinate: coord,
      terrainType: "land" as const,
      hasRoadData: false,
    };
  });
}

/**
 * Look up terrain types for a batch of coordinates.
 * Checks cache first, queries Overpass for misses.
 * Caches results with appropriate TTLs:
 * - Water results: 7-day TTL (604800 seconds)
 * - Road/land results: 72-hour TTL (259200 seconds)
 */
export async function lookupTerrain(
  coordinates: Coordinate[],
  cache: CacheStore,
): Promise<TerrainResult[]> {
  const results: TerrainResult[] = new Array(coordinates.length);
  const missIndices: number[] = [];
  const missCoordinates: Coordinate[] = [];

  // Check cache for each coordinate
  for (let i = 0; i < coordinates.length; i++) {
    const key = coordinateCacheKey(coordinates[i]);
    const cached = await cache.get(key);
    if (cached) {
      results[i] = cached;
    } else {
      missIndices.push(i);
      missCoordinates.push(coordinates[i]);
    }
  }

  // Fetch missing coordinates from Overpass
  if (missCoordinates.length > 0) {
    const corridor = await fetchTrackCorridor(missCoordinates);
    const classified = classifyCoordinates(missCoordinates, corridor);

    // Store results and cache them
    for (let i = 0; i < classified.length; i++) {
      const result = classified[i];
      const originalIndex = missIndices[i];
      results[originalIndex] = result;

      // Cache with appropriate TTL
      const key = coordinateCacheKey(missCoordinates[i]);
      const ttl = result.terrainType === "water" ? WATER_TTL_SECONDS : ROAD_TTL_SECONDS;
      await cache.set(key, result, ttl);
    }
  }

  return results;
}

/**
 * Convenience wrapper that calls fetchTrackCorridor + classifyCoordinates
 * without cache. Useful for one-off lookups or testing.
 */
export async function queryOSM(coordinates: Coordinate[]): Promise<TerrainResult[]> {
  const corridor = await fetchTrackCorridor(coordinates);
  return classifyCoordinates(coordinates, corridor);
}
