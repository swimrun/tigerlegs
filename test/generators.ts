import fc from "fast-check";
import type {
  Coordinate,
  GPXData,
  Track,
  Trackpoint,
  Waypoint,
} from "../src/shared/types.ts";

/** Arbitrary geographic coordinate with valid lat/lon ranges */
export const arbitraryCoordinate: fc.Arbitrary<Coordinate> = fc.record({
  lat: fc.double({ min: -90, max: 90, noNaN: true }),
  lon: fc.double({ min: -180, max: 180, noNaN: true }),
});

/** Arbitrary waypoint with coordinate, elevation, name, symbol, description */
export const arbitraryWaypoint: fc.Arbitrary<Waypoint> = fc.record({
  coordinate: arbitraryCoordinate,
  elevation: fc.double({ min: -500, max: 9000, noNaN: true }),
  name: fc.string({ minLength: 0, maxLength: 100 }),
  symbol: fc.string({ minLength: 0, maxLength: 50 }),
  description: fc.string({ minLength: 0, maxLength: 200 }),
});

/** Arbitrary trackpoint with coordinate, elevation, optional timestamp, index */
export const arbitraryTrackpoint: fc.Arbitrary<Trackpoint> = fc.record({
  coordinate: arbitraryCoordinate,
  elevation: fc.double({ min: -500, max: 9000, noNaN: true }),
  timestamp: fc.option(
    fc.date({ min: new Date("2000-01-01"), max: new Date("2030-12-31") }).map(
      (d) => d.toISOString(),
    ),
    { nil: null },
  ),
  index: fc.nat({ max: 100000 }),
});

/**
 * Arbitrary trackpoint with sequential indices.
 * Takes a starting index and generates a trackpoint at that index.
 */
export function arbitraryTrackpointAt(index: number): fc.Arbitrary<Trackpoint> {
  return fc.record({
    coordinate: arbitraryCoordinate,
    elevation: fc.double({ min: -500, max: 9000, noNaN: true }),
    timestamp: fc.option(
      fc.date({ min: new Date("2000-01-01"), max: new Date("2030-12-31") })
        .map((d) => d.toISOString()),
      { nil: null },
    ),
    index: fc.constant(index),
  });
}

/** Arbitrary track with name and array of trackpoints (sequentially indexed) */
export const arbitraryTrack: fc.Arbitrary<Track> = fc
  .array(arbitraryTrackpoint, { minLength: 1, maxLength: 50 })
  .map((trackpoints) => ({
    name: "Track",
    trackpoints: trackpoints.map((tp, i) => ({ ...tp, index: i })),
  }));

/** Arbitrary track with a custom name */
export function arbitraryTrackWithName(
  name: string,
  minPoints = 1,
  maxPoints = 50,
): fc.Arbitrary<Track> {
  return fc
    .array(arbitraryTrackpoint, { minLength: minPoints, maxLength: maxPoints })
    .map((trackpoints) => ({
      name,
      trackpoints: trackpoints.map((tp, i) => ({ ...tp, index: i })),
    }));
}

/**
 * Escape XML special characters in a string.
 */
function escapeXml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

/**
 * Generate a valid GPX XML string from GPXData.
 * Useful for round-trip testing of the parser.
 */
export function gpxDataToXml(data: GPXData): string {
  const waypointXml = data.waypoints
    .map(
      (wp) => `  <wpt lat="${wp.coordinate.lat}" lon="${wp.coordinate.lon}">
    <ele>${wp.elevation}</ele>
    <name>${escapeXml(wp.name)}</name>
    <sym>${escapeXml(wp.symbol)}</sym>
    <desc>${escapeXml(wp.description)}</desc>
  </wpt>`,
    )
    .join("\n");

  const trackXml = data.tracks
    .map((track) => {
      const trkpts = track.trackpoints
        .map((tp) => {
          const timeTag = tp.timestamp
            ? `\n      <time>${tp.timestamp}</time>`
            : "";
          return `    <trkpt lat="${tp.coordinate.lat}" lon="${tp.coordinate.lon}">
      <ele>${tp.elevation}</ele>${timeTag}
    </trkpt>`;
        })
        .join("\n");
      return `  <trk>
    <name>${escapeXml(track.name)}</name>
    <trkseg>
${trkpts}
    </trkseg>
  </trk>`;
    })
    .join("\n");

  return `<?xml version="1.0" encoding="UTF-8"?>
<gpx xmlns="http://www.topografix.com/GPX/1/1" version="1.1" creator="test-generator">
${waypointXml}
${trackXml}
</gpx>`;
}

/** Arbitrary valid GPX XML string for round-trip testing */
export const arbitraryGPXString: fc.Arbitrary<string> = fc
  .record({
    waypoints: fc.array(arbitraryWaypoint, { minLength: 0, maxLength: 10 }),
    tracks: fc.array(arbitraryTrack, { minLength: 1, maxLength: 3 }),
  })
  .map((data: GPXData) => gpxDataToXml(data));

/**
 * Arbitrary GPXData with waypoints and tracks for direct use in tests.
 */
export const arbitraryGPXData: fc.Arbitrary<GPXData> = fc.record({
  waypoints: fc.array(arbitraryWaypoint, { minLength: 0, maxLength: 10 }),
  tracks: fc.array(arbitraryTrack, { minLength: 1, maxLength: 3 }),
});
