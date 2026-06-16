import { assertEquals } from "@std/assert";
import { DOMParser } from "@xmldom/xmldom";
import {
  parseCoordinate,
  parseGPX,
  parseTracks,
  parseWaypoints,
} from "../../src/client/gpx-parser.ts";
import { gpxDataToXml } from "../generators.ts";
import type { GPXData } from "../../src/shared/types.ts";

/** Wrap content in a minimal valid GPX document */
function wrapGPX(content: string): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<gpx xmlns="http://www.topografix.com/GPX/1/1" version="1.1" creator="test">
${content}
</gpx>`;
}

// --- Valid GPX parsing ---

Deno.test("parseGPX - valid GPX string parses correctly", () => {
  const gpxData: GPXData = {
    waypoints: [
      {
        coordinate: { lat: 45.123456, lon: 5.678901 },
        elevation: 235,
        name: "Start",
        symbol: "200",
        description: "Start of swim",
      },
    ],
    tracks: [
      {
        name: "Morning Run",
        trackpoints: [
          {
            coordinate: { lat: 45.123456, lon: 5.678901 },
            elevation: 235,
            timestamp: "2024-06-15T08:30:00Z",
            index: 0,
          },
          {
            coordinate: { lat: 45.1235, lon: 5.679 },
            elevation: 235,
            timestamp: "2024-06-15T08:30:05Z",
            index: 1,
          },
        ],
      },
    ],
  };

  const xml = gpxDataToXml(gpxData);
  const result = parseGPX(xml);

  assertEquals(result.ok, true);
  if (!result.ok) return;

  assertEquals(result.value.waypoints.length, 1);
  assertEquals(result.value.waypoints[0].name, "Start");
  assertEquals(result.value.waypoints[0].symbol, "200");
  assertEquals(result.value.waypoints[0].description, "Start of swim");
  assertEquals(result.value.waypoints[0].coordinate.lat, 45.123456);
  assertEquals(result.value.waypoints[0].coordinate.lon, 5.678901);
  assertEquals(result.value.waypoints[0].elevation, 235);

  assertEquals(result.value.tracks.length, 1);
  assertEquals(result.value.tracks[0].name, "Morning Run");
  assertEquals(result.value.tracks[0].trackpoints.length, 2);
  assertEquals(result.value.tracks[0].trackpoints[0].index, 0);
  assertEquals(result.value.tracks[0].trackpoints[1].index, 1);
  assertEquals(
    result.value.tracks[0].trackpoints[0].timestamp,
    "2024-06-15T08:30:00Z",
  );
});

// --- Invalid XML returns error Result ---

Deno.test("parseGPX - invalid XML returns error Result", () => {
  const result = parseGPX("<gpx><unclosed>");
  assertEquals(result.ok, false);
  if (result.ok) return;
  assertEquals(result.error, "File could not be parsed");
});

Deno.test("parseGPX - completely garbled input returns error Result", () => {
  const result = parseGPX("this is not xml at all ><< }}");
  assertEquals(result.ok, false);
  if (result.ok) return;
  assertEquals(result.error, "File could not be parsed");
});

Deno.test("parseGPX - empty string returns error Result", () => {
  const result = parseGPX("");
  assertEquals(result.ok, false);
  if (result.ok) return;
  assertEquals(result.error, "Empty GPX content provided");
});

// --- Empty track (no trkpt) returns error Result ---

Deno.test("parseGPX - empty track with no trkpt returns error Result", () => {
  const xml = wrapGPX(`
  <trk>
    <name>Empty Track</name>
    <trkseg></trkseg>
  </trk>`);

  const result = parseGPX(xml);
  assertEquals(result.ok, false);
  if (result.ok) return;
  assertEquals(result.error, "No track data was found");
});

Deno.test("parseGPX - GPX with only waypoints and no tracks returns error", () => {
  const xml = wrapGPX(`
  <wpt lat="45.0" lon="5.0">
    <name>Just a waypoint</name>
  </wpt>`);

  const result = parseGPX(xml);
  assertEquals(result.ok, false);
  if (result.ok) return;
  assertEquals(result.error, "No track data was found");
});

// --- Coordinates preserved to 6 decimal places ---

Deno.test("parseGPX - coordinates preserved to 6 decimal places", () => {
  const xml = wrapGPX(`
  <trk>
    <name>Test</name>
    <trkseg>
      <trkpt lat="45.1234567890" lon="5.9876543210">
        <ele>100</ele>
      </trkpt>
    </trkseg>
  </trk>`);

  const result = parseGPX(xml);
  assertEquals(result.ok, true);
  if (!result.ok) return;

  const tp = result.value.tracks[0].trackpoints[0];
  assertEquals(tp.coordinate.lat, 45.123457); // rounded to 6 decimals
  assertEquals(tp.coordinate.lon, 5.987654); // rounded to 6 decimals
});

Deno.test("parseCoordinate - preserves to 6 decimal places", () => {
  const parser = new DOMParser();
  const doc = parser.parseFromString(
    '<trkpt lat="45.1234569" lon="-5.9876541"/>',
    "application/xml",
  );
  const element = doc.documentElement as unknown as Element;

  const coord = parseCoordinate(element);
  assertEquals(coord.lat, 45.123457);
  assertEquals(coord.lon, -5.987654);
});

Deno.test("parseCoordinate - preserves exact 6-digit values", () => {
  const parser = new DOMParser();
  const doc = parser.parseFromString(
    '<trkpt lat="45.123456" lon="5.678901"/>',
    "application/xml",
  );
  const element = doc.documentElement as unknown as Element;

  const coord = parseCoordinate(element);
  assertEquals(coord.lat, 45.123456);
  assertEquals(coord.lon, 5.678901);
});

// --- Elevation rounded to integer ---

Deno.test("parseGPX - elevation rounded to integer", () => {
  const xml = wrapGPX(`
  <trk>
    <name>Test</name>
    <trkseg>
      <trkpt lat="45.0" lon="5.0">
        <ele>234.7</ele>
      </trkpt>
      <trkpt lat="45.0" lon="5.0">
        <ele>234.2</ele>
      </trkpt>
      <trkpt lat="45.0" lon="5.0">
        <ele>234.5</ele>
      </trkpt>
    </trkseg>
  </trk>`);

  const result = parseGPX(xml);
  assertEquals(result.ok, true);
  if (!result.ok) return;

  assertEquals(result.value.tracks[0].trackpoints[0].elevation, 235); // rounds up
  assertEquals(result.value.tracks[0].trackpoints[1].elevation, 234); // rounds down
  assertEquals(result.value.tracks[0].trackpoints[2].elevation, 235); // .5 rounds up
});

// --- Timestamps truncated to seconds ---

Deno.test("parseGPX - timestamps truncated to 1-second ISO 8601", () => {
  const xml = wrapGPX(`
  <trk>
    <name>Test</name>
    <trkseg>
      <trkpt lat="45.0" lon="5.0">
        <ele>100</ele>
        <time>2024-06-15T08:30:00.123Z</time>
      </trkpt>
      <trkpt lat="45.0" lon="5.0">
        <ele>100</ele>
        <time>2024-06-15T08:30:05.999Z</time>
      </trkpt>
    </trkseg>
  </trk>`);

  const result = parseGPX(xml);
  assertEquals(result.ok, true);
  if (!result.ok) return;

  assertEquals(
    result.value.tracks[0].trackpoints[0].timestamp,
    "2024-06-15T08:30:00Z",
  );
  assertEquals(
    result.value.tracks[0].trackpoints[1].timestamp,
    "2024-06-15T08:30:05Z",
  );
});

Deno.test("parseGPX - timestamps without milliseconds preserved as-is", () => {
  const xml = wrapGPX(`
  <trk>
    <name>Test</name>
    <trkseg>
      <trkpt lat="45.0" lon="5.0">
        <ele>100</ele>
        <time>2024-06-15T08:30:00Z</time>
      </trkpt>
    </trkseg>
  </trk>`);

  const result = parseGPX(xml);
  assertEquals(result.ok, true);
  if (!result.ok) return;

  assertEquals(
    result.value.tracks[0].trackpoints[0].timestamp,
    "2024-06-15T08:30:00Z",
  );
});

Deno.test("parseGPX - trackpoints without timestamps return null", () => {
  const xml = wrapGPX(`
  <trk>
    <name>Test</name>
    <trkseg>
      <trkpt lat="45.0" lon="5.0">
        <ele>100</ele>
      </trkpt>
    </trkseg>
  </trk>`);

  const result = parseGPX(xml);
  assertEquals(result.ok, true);
  if (!result.ok) return;

  assertEquals(result.value.tracks[0].trackpoints[0].timestamp, null);
});

// --- Additional structural tests ---

Deno.test("parseWaypoints - parses waypoints from document", () => {
  const xml = wrapGPX(`
  <wpt lat="45.0" lon="5.0">
    <ele>100.8</ele>
    <name>WP1</name>
    <sym>200</sym>
    <desc>First waypoint</desc>
  </wpt>
  <wpt lat="46.0" lon="6.0">
    <ele>200.3</ele>
    <name>WP2</name>
    <sym>201</sym>
    <desc>Second waypoint</desc>
  </wpt>`);

  const parser = new DOMParser();
  const doc = parser.parseFromString(xml, "application/xml") as unknown as Document;
  const waypoints = parseWaypoints(doc);

  assertEquals(waypoints.length, 2);
  assertEquals(waypoints[0].name, "WP1");
  assertEquals(waypoints[0].symbol, "200");
  assertEquals(waypoints[0].description, "First waypoint");
  assertEquals(waypoints[0].elevation, 101); // rounded
  assertEquals(waypoints[1].name, "WP2");
  assertEquals(waypoints[1].elevation, 200); // rounded
});

Deno.test("parseTracks - parses tracks with sequential trackpoint indices", () => {
  const xml = wrapGPX(`
  <trk>
    <name>Trail</name>
    <trkseg>
      <trkpt lat="45.0" lon="5.0"><ele>100</ele></trkpt>
      <trkpt lat="45.1" lon="5.1"><ele>110</ele></trkpt>
    </trkseg>
    <trkseg>
      <trkpt lat="45.2" lon="5.2"><ele>120</ele></trkpt>
    </trkseg>
  </trk>`);

  const parser = new DOMParser();
  const doc = parser.parseFromString(xml, "application/xml") as unknown as Document;
  const tracks = parseTracks(doc);

  assertEquals(tracks.length, 1);
  assertEquals(tracks[0].name, "Trail");
  assertEquals(tracks[0].trackpoints.length, 3);
  // Sequential indices across segments
  assertEquals(tracks[0].trackpoints[0].index, 0);
  assertEquals(tracks[0].trackpoints[1].index, 1);
  assertEquals(tracks[0].trackpoints[2].index, 2);
});
