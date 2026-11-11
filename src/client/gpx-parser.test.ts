import { expect, it } from "vitest";
import { DOMParser } from "@xmldom/xmldom";
import { parseCoordinate, parseGPX, parseTracks, parseWaypoints } from "./gpx-parser.ts";

// Helper: minimal valid GPX wrapper
function wrapGPX(content: string): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<gpx xmlns="http://www.topografix.com/GPX/1/1" version="1.1" creator="test">
${content}
</gpx>`;
}

it("parseGPX - parses a valid GPX file with waypoints and tracks", () => {
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
  expect(result.ok).toEqual(true);
  if (!result.ok) return;

  expect(result.value.waypoints.length).toEqual(1);
  expect(result.value.waypoints[0].name).toEqual("Start");
  expect(result.value.waypoints[0].symbol).toEqual("200");
  expect(result.value.waypoints[0].description).toEqual("Start of swim");
  expect(result.value.waypoints[0].coordinate.lat).toEqual(45.123456);
  expect(result.value.waypoints[0].coordinate.lon).toEqual(5.678901);
  expect(result.value.waypoints[0].elevation).toEqual(235); // rounded to integer

  expect(result.value.tracks.length).toEqual(1);
  expect(result.value.tracks[0].name).toEqual("Morning Run");
  expect(result.value.tracks[0].trackpoints.length).toEqual(2);
  expect(result.value.tracks[0].trackpoints[0].index).toEqual(0);
  expect(result.value.tracks[0].trackpoints[1].index).toEqual(1);
  expect(result.value.tracks[0].trackpoints[0].timestamp).toEqual("2024-06-15T08:30:00Z");
  expect(result.value.tracks[0].trackpoints[1].elevation).toEqual(235);
});

it("parseGPX - returns error for empty string", () => {
  const result = parseGPX("");
  expect(result.ok).toEqual(false);
  if (result.ok) return;
  expect(result.error).toEqual("Empty GPX content provided");
});

it("parseGPX - returns error for whitespace-only string", () => {
  const result = parseGPX("   \n\t  ");
  expect(result.ok).toEqual(false);
  if (result.ok) return;
  expect(result.error).toEqual("Empty GPX content provided");
});

it("parseGPX - returns error for invalid XML", () => {
  const result = parseGPX("<gpx><unclosed>");
  expect(result.ok).toEqual(false);
  if (result.ok) return;
  expect(result.error).toEqual("File could not be parsed");
});

it("parseGPX - returns error when no trackpoints exist", () => {
  const xml = wrapGPX(`
  <wpt lat="45.0" lon="5.0">
    <name>Just a waypoint</name>
  </wpt>`);

  const result = parseGPX(xml);
  expect(result.ok).toEqual(false);
  if (result.ok) return;
  expect(result.error).toEqual("No track data was found");
});

it("parseGPX - returns error when tracks have no trackpoints", () => {
  const xml = wrapGPX(`
  <trk>
    <name>Empty Track</name>
    <trkseg></trkseg>
  </trk>`);

  const result = parseGPX(xml);
  expect(result.ok).toEqual(false);
  if (result.ok) return;
  expect(result.error).toEqual("No track data was found");
});

it("parseGPX - preserves coordinates to 6 decimal places", () => {
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
  expect(result.ok).toEqual(true);
  if (!result.ok) return;

  const tp = result.value.tracks[0].trackpoints[0];
  expect(tp.coordinate.lat).toEqual(45.123457); // rounded to 6 decimals
  expect(tp.coordinate.lon).toEqual(5.987654); // rounded to 6 decimals
});

it("parseGPX - rounds elevation to integer", () => {
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
  expect(result.ok).toEqual(true);
  if (!result.ok) return;

  expect(result.value.tracks[0].trackpoints[0].elevation).toEqual(235);
  expect(result.value.tracks[0].trackpoints[1].elevation).toEqual(234);
});

it("parseGPX - truncates timestamps to 1-second ISO 8601", () => {
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
  expect(result.ok).toEqual(true);
  if (!result.ok) return;

  expect(result.value.tracks[0].trackpoints[0].timestamp).toEqual("2024-06-15T08:30:00Z");
  expect(result.value.tracks[0].trackpoints[1].timestamp).toEqual("2024-06-15T08:30:05Z");
});

it("parseGPX - handles trackpoints without timestamps", () => {
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
  expect(result.ok).toEqual(true);
  if (!result.ok) return;

  expect(result.value.tracks[0].trackpoints[0].timestamp).toEqual(null);
});

it("parseGPX - handles multiple tracks", () => {
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
  expect(result.ok).toEqual(true);
  if (!result.ok) return;

  expect(result.value.tracks.length).toEqual(2);
  expect(result.value.tracks[0].name).toEqual("Track 1");
  expect(result.value.tracks[0].trackpoints.length).toEqual(1);
  expect(result.value.tracks[1].name).toEqual("Track 2");
  expect(result.value.tracks[1].trackpoints.length).toEqual(2);
});

it("parseGPX - handles multiple track segments within a track", () => {
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
  expect(result.ok).toEqual(true);
  if (!result.ok) return;

  // All trackpoints from both segments are combined, indexed sequentially
  expect(result.value.tracks[0].trackpoints.length).toEqual(3);
  expect(result.value.tracks[0].trackpoints[0].index).toEqual(0);
  expect(result.value.tracks[0].trackpoints[1].index).toEqual(1);
  expect(result.value.tracks[0].trackpoints[2].index).toEqual(2);
});

it("parseGPX - handles waypoints with missing optional fields", () => {
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
  expect(result.ok).toEqual(true);
  if (!result.ok) return;

  const wp = result.value.waypoints[0];
  expect(wp.name).toEqual("");
  expect(wp.symbol).toEqual("");
  expect(wp.description).toEqual("");
  expect(wp.elevation).toEqual(0);
});

it("parseCoordinate - parses lat/lon from element with 6 decimal precision", () => {
  const parser = new DOMParser();
  const doc = parser.parseFromString(
    '<trkpt lat="45.1234569" lon="-5.9876541"/>',
    "application/xml",
  );
  const element = doc.documentElement as unknown as Element;

  const coord = parseCoordinate(element);
  expect(coord.lat).toEqual(45.123457);
  expect(coord.lon).toEqual(-5.987654);
});

it("parseWaypoints - parses multiple waypoints from document", () => {
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
  const doc = parser.parseFromString(xml, "application/xml") as unknown as Document;
  const waypoints = parseWaypoints(doc);

  expect(waypoints.length).toEqual(2);
  expect(waypoints[0].name).toEqual("WP1");
  expect(waypoints[0].symbol).toEqual("200");
  expect(waypoints[1].name).toEqual("WP2");
  expect(waypoints[1].symbol).toEqual("201");
});

it("parseTracks - parses tracks from document", () => {
  const xml = wrapGPX(`
  <trk>
    <name>Trail</name>
    <trkseg>
      <trkpt lat="45.0" lon="5.0"><ele>100</ele></trkpt>
    </trkseg>
  </trk>`);

  const parser = new DOMParser();
  const doc = parser.parseFromString(xml, "application/xml") as unknown as Document;
  const tracks = parseTracks(doc);

  expect(tracks.length).toEqual(1);
  expect(tracks[0].name).toEqual("Trail");
  expect(tracks[0].trackpoints.length).toEqual(1);
});
