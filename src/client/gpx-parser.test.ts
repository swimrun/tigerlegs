import { assertEquals } from "@std/assert";
import { parseCoordinate, parseGPX, parseTracks, parseWaypoints } from "./gpx-parser.ts";

// Helper: minimal valid GPX wrapper
function wrapGPX(content: string): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<gpx xmlns="http://www.topografix.com/GPX/1/1" version="1.1" creator="test">
${content}
</gpx>`;
}

Deno.test("parseGPX - parses a valid GPX file with waypoints and tracks", () => {
  const xml = wrapGPX(`
  <wpt lat="45.123456" lon="5.678901">
    <ele>234.7</ele>
    <name>Start</name>
    <sym>200</sym>
    <desc>Start of swim</desc>
  </wpt>
  <trk>
    <name>Morning Run</name>
    <trkseg>
      <trkpt lat="45.123456" lon="5.678901">
        <ele>234.7</ele>
        <time>2024-06-15T08:30:00Z</time>
      </trkpt>
      <trkpt lat="45.123500" lon="5.679000">
        <ele>235.2</ele>
        <time>2024-06-15T08:30:05Z</time>
      </trkpt>
    </trkseg>
  </trk>`);

  const result = parseGPX(xml);
  assertEquals(result.ok, true);
  if (!result.ok) return;

  assertEquals(result.value.waypoints.length, 1);
  assertEquals(result.value.waypoints[0].name, "Start");
  assertEquals(result.value.waypoints[0].symbol, "200");
  assertEquals(result.value.waypoints[0].description, "Start of swim");
  assertEquals(result.value.waypoints[0].coordinate.lat, 45.123456);
  assertEquals(result.value.waypoints[0].coordinate.lon, 5.678901);
  assertEquals(result.value.waypoints[0].elevation, 235); // rounded to integer

  assertEquals(result.value.tracks.length, 1);
  assertEquals(result.value.tracks[0].name, "Morning Run");
  assertEquals(result.value.tracks[0].trackpoints.length, 2);
  assertEquals(result.value.tracks[0].trackpoints[0].index, 0);
  assertEquals(result.value.tracks[0].trackpoints[1].index, 1);
  assertEquals(result.value.tracks[0].trackpoints[0].timestamp, "2024-06-15T08:30:00Z");
  assertEquals(result.value.tracks[0].trackpoints[1].elevation, 235);
});

Deno.test("parseGPX - returns error for empty string", () => {
  const result = parseGPX("");
  assertEquals(result.ok, false);
  if (result.ok) return;
  assertEquals(result.error, "Empty GPX content provided");
});

Deno.test("parseGPX - returns error for whitespace-only string", () => {
  const result = parseGPX("   \n\t  ");
  assertEquals(result.ok, false);
  if (result.ok) return;
  assertEquals(result.error, "Empty GPX content provided");
});

Deno.test("parseGPX - returns error for invalid XML", () => {
  const result = parseGPX("<gpx><unclosed>");
  assertEquals(result.ok, false);
  if (result.ok) return;
  assertEquals(result.error, "File could not be parsed");
});

Deno.test("parseGPX - returns error when no trackpoints exist", () => {
  const xml = wrapGPX(`
  <wpt lat="45.0" lon="5.0">
    <name>Just a waypoint</name>
  </wpt>`);

  const result = parseGPX(xml);
  assertEquals(result.ok, false);
  if (result.ok) return;
  assertEquals(result.error, "No track data was found");
});

Deno.test("parseGPX - returns error when tracks have no trackpoints", () => {
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

Deno.test("parseGPX - preserves coordinates to 6 decimal places", () => {
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

Deno.test("parseGPX - rounds elevation to integer", () => {
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
    </trkseg>
  </trk>`);

  const result = parseGPX(xml);
  assertEquals(result.ok, true);
  if (!result.ok) return;

  assertEquals(result.value.tracks[0].trackpoints[0].elevation, 235);
  assertEquals(result.value.tracks[0].trackpoints[1].elevation, 234);
});

Deno.test("parseGPX - truncates timestamps to 1-second ISO 8601", () => {
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

  assertEquals(result.value.tracks[0].trackpoints[0].timestamp, "2024-06-15T08:30:00Z");
  assertEquals(result.value.tracks[0].trackpoints[1].timestamp, "2024-06-15T08:30:05Z");
});

Deno.test("parseGPX - handles trackpoints without timestamps", () => {
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

Deno.test("parseGPX - handles multiple tracks", () => {
  const xml = wrapGPX(`
  <trk>
    <name>Track 1</name>
    <trkseg>
      <trkpt lat="45.0" lon="5.0"><ele>100</ele></trkpt>
    </trkseg>
  </trk>
  <trk>
    <name>Track 2</name>
    <trkseg>
      <trkpt lat="46.0" lon="6.0"><ele>200</ele></trkpt>
      <trkpt lat="46.1" lon="6.1"><ele>210</ele></trkpt>
    </trkseg>
  </trk>`);

  const result = parseGPX(xml);
  assertEquals(result.ok, true);
  if (!result.ok) return;

  assertEquals(result.value.tracks.length, 2);
  assertEquals(result.value.tracks[0].name, "Track 1");
  assertEquals(result.value.tracks[0].trackpoints.length, 1);
  assertEquals(result.value.tracks[1].name, "Track 2");
  assertEquals(result.value.tracks[1].trackpoints.length, 2);
});

Deno.test("parseGPX - handles multiple track segments within a track", () => {
  const xml = wrapGPX(`
  <trk>
    <name>Multi-seg</name>
    <trkseg>
      <trkpt lat="45.0" lon="5.0"><ele>100</ele></trkpt>
      <trkpt lat="45.1" lon="5.1"><ele>110</ele></trkpt>
    </trkseg>
    <trkseg>
      <trkpt lat="45.2" lon="5.2"><ele>120</ele></trkpt>
    </trkseg>
  </trk>`);

  const result = parseGPX(xml);
  assertEquals(result.ok, true);
  if (!result.ok) return;

  // All trackpoints from both segments are combined, indexed sequentially
  assertEquals(result.value.tracks[0].trackpoints.length, 3);
  assertEquals(result.value.tracks[0].trackpoints[0].index, 0);
  assertEquals(result.value.tracks[0].trackpoints[1].index, 1);
  assertEquals(result.value.tracks[0].trackpoints[2].index, 2);
});

Deno.test("parseGPX - handles waypoints with missing optional fields", () => {
  const xml = wrapGPX(`
  <wpt lat="45.0" lon="5.0">
  </wpt>
  <trk>
    <name>Test</name>
    <trkseg>
      <trkpt lat="45.0" lon="5.0"><ele>100</ele></trkpt>
    </trkseg>
  </trk>`);

  const result = parseGPX(xml);
  assertEquals(result.ok, true);
  if (!result.ok) return;

  const wp = result.value.waypoints[0];
  assertEquals(wp.name, "");
  assertEquals(wp.symbol, "");
  assertEquals(wp.description, "");
  assertEquals(wp.elevation, 0);
});

Deno.test("parseCoordinate - parses lat/lon from element with 6 decimal precision", () => {
  const parser = new DOMParser();
  const doc = parser.parseFromString(
    '<trkpt lat="45.1234569" lon="-5.9876541"/>',
    "application/xml",
  );
  const element = doc.documentElement;

  const coord = parseCoordinate(element);
  assertEquals(coord.lat, 45.123457);
  assertEquals(coord.lon, -5.987654);
});

Deno.test("parseWaypoints - parses multiple waypoints from document", () => {
  const xml = wrapGPX(`
  <wpt lat="45.0" lon="5.0">
    <ele>100</ele>
    <name>WP1</name>
    <sym>200</sym>
    <desc>First</desc>
  </wpt>
  <wpt lat="46.0" lon="6.0">
    <ele>200</ele>
    <name>WP2</name>
    <sym>201</sym>
    <desc>Second</desc>
  </wpt>`);

  const parser = new DOMParser();
  const doc = parser.parseFromString(xml, "application/xml");
  const waypoints = parseWaypoints(doc);

  assertEquals(waypoints.length, 2);
  assertEquals(waypoints[0].name, "WP1");
  assertEquals(waypoints[0].symbol, "200");
  assertEquals(waypoints[1].name, "WP2");
  assertEquals(waypoints[1].symbol, "201");
});

Deno.test("parseTracks - parses tracks from document", () => {
  const xml = wrapGPX(`
  <trk>
    <name>Trail</name>
    <trkseg>
      <trkpt lat="45.0" lon="5.0"><ele>100</ele></trkpt>
    </trkseg>
  </trk>`);

  const parser = new DOMParser();
  const doc = parser.parseFromString(xml, "application/xml");
  const tracks = parseTracks(doc);

  assertEquals(tracks.length, 1);
  assertEquals(tracks[0].name, "Trail");
  assertEquals(tracks[0].trackpoints.length, 1);
});
