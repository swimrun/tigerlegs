import type { Coordinate, Segment, Trackpoint } from "../shared/types.ts";
import { calculateTrackDistance } from "../shared/distance-calculator.ts";
import { cleanSegments } from "./segment-cleaner.ts";

export interface WaterBody {
  name?: string;
  outer: Coordinate[][];
  inner: Coordinate[][];
}

interface OverpassPoint {
  lat: number;
  lon: number;
}

interface OverpassElement {
  type: "way" | "relation";
  tags?: Record<string, string>;
  geometry?: OverpassPoint[];
  members?: { role: string; geometry?: OverpassPoint[] }[];
}

// Public Overpass instances; the first is often overloaded, so fall through to the next.
const REQUEST_TIMEOUT_MS = 20000;
const OVERPASS_URLS = [
  "https://overpass-api.de/api/interpreter",
  "https://overpass.private.coffee/api/interpreter",
  "https://overpass.kumi.systems/api/interpreter",
];
const MIN_SWIM_SPAN_KM = 0.04;
const MAX_LAND_GAP_POINTS = 10;
// Nobody swims faster than this; faster stretches along a shore are runs, not swims.
const MAX_SWIM_KPH = 7;
const SPEED_WINDOW_SECONDS = 40;

const toCoords = (g: OverpassPoint[]): Coordinate[] => g.map((p) => ({ lat: p.lat, lon: p.lon }));
const same = (a: Coordinate, b: Coordinate) => a.lat === b.lat && a.lon === b.lon;

/** Join open way pieces end to end into closed rings; pieces that never close are dropped. */
export function assembleRings(pieces: Coordinate[][]): Coordinate[][] {
  const open = pieces.filter((p) => p.length > 1).map((p) => [...p]);
  const rings: Coordinate[][] = [];
  while (open.length > 0) {
    let ring = open.pop()!;
    let extended = true;
    while (extended && !same(ring[0], ring[ring.length - 1])) {
      extended = false;
      for (let i = 0; i < open.length; i++) {
        const p = open[i];
        const end = ring[ring.length - 1];
        if (same(p[0], end)) ring = ring.concat(p.slice(1));
        else if (same(p[p.length - 1], end)) ring = ring.concat(p.slice(0, -1).reverse());
        else continue;
        open.splice(i, 1);
        extended = true;
        break;
      }
    }
    if (ring.length >= 4 && same(ring[0], ring[ring.length - 1])) rings.push(ring);
  }
  return rings;
}

/** Convert an Overpass `out geom` response into water bodies with outer and inner rings. */
export function parseWater(json: { elements?: OverpassElement[] }): WaterBody[] {
  const bodies: WaterBody[] = [];
  for (const el of json.elements ?? []) {
    const name = el.tags?.name;
    if (el.type === "way" && el.geometry) {
      const ring = toCoords(el.geometry);
      if (ring.length >= 4 && same(ring[0], ring[ring.length - 1])) {
        bodies.push({ name, outer: [ring], inner: [] });
      }
    } else if (el.type === "relation" && el.members) {
      const part = (role: string) =>
        assembleRings(
          el.members!.filter((m) => m.role === role && m.geometry).map((m) => toCoords(m.geometry!)),
        );
      const outer = part("outer");
      if (outer.length > 0) bodies.push({ name, outer, inner: part("inner") });
    }
  }
  return bodies;
}

export function pointInRing(p: Coordinate, ring: Coordinate[]): boolean {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const a = ring[i], b = ring[j];
    if (
      (a.lat > p.lat) !== (b.lat > p.lat) &&
      p.lon < ((b.lon - a.lon) * (p.lat - a.lat)) / (b.lat - a.lat) + a.lon
    ) inside = !inside;
  }
  return inside;
}

export function pointInWater(p: Coordinate, water: WaterBody[]): boolean {
  return water.some((w) =>
    w.outer.some((r) => pointInRing(p, r)) && !w.inner.some((r) => pointInRing(p, r))
  );
}

/** Fetch lakes, ponds and riverbanks around the track from OpenStreetMap (Overpass). */
export async function fetchWater(points: Trackpoint[], signal?: AbortSignal): Promise<WaterBody[]> {
  const lats = points.map((p) => p.coordinate.lat), lons = points.map((p) => p.coordinate.lon);
  const pad = 0.003;
  const bbox = [
    Math.min(...lats) - pad,
    Math.min(...lons) - pad,
    Math.max(...lats) + pad,
    Math.max(...lons) + pad,
  ].join(",");
  const query = `[out:json][timeout:25];(way["natural"="water"](${bbox});` +
    `relation["natural"="water"](${bbox});way["waterway"="riverbank"](${bbox}););out geom;`;
  let lastError = "no Overpass server reachable";
  for (const url of OVERPASS_URLS) {
    try {
      const response = await fetch(url, {
        method: "POST",
        body: "data=" + encodeURIComponent(query),
        headers: { "content-type": "application/x-www-form-urlencoded" },
        signal: signal
          ? AbortSignal.any([signal, AbortSignal.timeout(REQUEST_TIMEOUT_MS)])
          : AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      });
      if (response.ok) return parseWater(await response.json());
      lastError = `Overpass returned status ${response.status}`;
    } catch (e) {
      if (signal?.aborted) throw e;
      // timeouts and network errors fall through to the next mirror
      lastError = e instanceof Error ? e.message : String(e);
    }
  }
  throw new Error(lastError);
}

/** Speed in km/h around point i over about SPEED_WINDOW_SECONDS, or null without timestamps. */
function localSpeedKph(points: Trackpoint[], i: number): number | null {
  let a = i, b = i;
  const t = (k: number) => (points[k].timestamp ? Date.parse(points[k].timestamp!) : NaN);
  while (a > 0 && t(i) - t(a) < (SPEED_WINDOW_SECONDS / 2) * 1000) a--;
  while (b < points.length - 1 && t(b) - t(i) < (SPEED_WINDOW_SECONDS / 2) * 1000) b++;
  const dt = (t(b) - t(a)) / 1000;
  if (!(dt > 0)) return null;
  return (calculateTrackDistance(points.slice(a, b + 1)) / dt) * 3600;
}

/** Index ranges [start, end] of trackpoints in water, bridging short gaps and dropping short spans. */
export function waterSpans(points: Trackpoint[], water: WaterBody[]): [number, number][] {
  const spans: [number, number][] = [];
  let start = -1, lastIn = -1;
  const flush = () => {
    if (start >= 0 && calculateTrackDistance(points.slice(start, lastIn + 1)) >= MIN_SWIM_SPAN_KM) {
      spans.push([start, lastIn]);
    }
    start = -1;
  };
  for (let i = 0; i < points.length; i++) {
    if (pointInWater(points[i].coordinate, water) && (localSpeedKph(points, i) ?? 0) < MAX_SWIM_KPH) {
      if (start < 0) start = i;
      lastIn = i;
    } else if (start >= 0 && i - lastIn > MAX_LAND_GAP_POINTS) {
      flush();
    }
  }
  flush();
  return spans;
}

/**
 * Split run segments where the track passes through mapped water, so a "run" that
 * is really part swim becomes run, swim, run. Neighbouring swims are merged afterwards.
 */
export function refineWithWater(
  segments: Segment[],
  points: Trackpoint[],
  water: WaterBody[],
): Segment[] {
  const spans = waterSpans(points, water);
  if (spans.length === 0) return segments;

  const pieces: Segment[] = [];
  for (const seg of segments) {
    if (seg.type !== "run") {
      pieces.push(seg);
      continue;
    }
    let cursor = seg.startTrackpointIndex;
    const push = (type: Segment["type"], from: number, to: number) => {
      if (to < from) return;
      pieces.push({
        ...seg,
        type,
        startTrackpointIndex: from,
        endTrackpointIndex: to,
        detectedBy: type === "swim" ? [...new Set([...seg.detectedBy, "landscape" as const])] : seg.detectedBy,
        confidenceScore: type === "swim" ? Math.max(seg.confidenceScore, 0.8) : seg.confidenceScore,
      });
    };
    for (const [s, e] of spans) {
      const from = Math.max(s, seg.startTrackpointIndex), to = Math.min(e, seg.endTrackpointIndex);
      if (to < from) continue;
      push("run", cursor, from - 1);
      push("swim", from, to);
      cursor = to + 1;
    }
    push("run", cursor, seg.endTrackpointIndex);
  }

  const withDistances = pieces.map((seg, i, all) => {
    const end = i < all.length - 1 ? seg.endTrackpointIndex + 2 : seg.endTrackpointIndex + 1;
    return {
      ...seg,
      distanceKm: calculateTrackDistance(points.slice(seg.startTrackpointIndex, end)),
    };
  });
  return cleanSegments(withDistances);
}
