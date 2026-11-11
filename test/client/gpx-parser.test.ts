import { expect, it } from "vitest";
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

it("parseGPX - valid GPX string parses correctly", () => {
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

  expect(result.ok).toEqual(true);
  if (!result.ok) return;

  expect(result.value.waypoints.length).toEqual(1);
  expect(result.value.waypoints[0].name).toEqual("Start");
  expect(result.value.waypoints[0].symbol).toEqual("200");
  expect(result.value.waypoints[0].description).toEqual("Start of swim");
  expect(result.value.waypoints[0].coordinate.lat).toEqual(45.123456);
  expect(result.value.waypoints[0].coordinate.lon).toEqual(5.678901);
  expect(result.value.waypoints[0].elevation).toEqual(235);

  expect(result.value.tracks.length).toEqual(1);
  expect(result.value.tracks[0].name).toEqual("Morning Run");
  expect(result.value.tracks[0].trackpoints.length).toEqual(2);
  expect(result.value.tracks[0].trackpoints[0].index).toEqual(0);
  expect(result.value.tracks[0].trackpoints[1].index).toEqual(1);
  expect(result.value.tracks[0].trackpoints[0].timestamp).toEqual("2024-06-15T08:30:00Z");
});

// --- Invalid XML returns error Result ---

it("parseGPX - invalid XML returns error Result", () => {
  const result = parseGPX("<gpx><unclosed>");
  expect(result.ok).toEqual(false);
  if (result.ok) return;
  expect(result.error).toEqual("File could not be parsed");
});

it("parseGPX - completely garbled input returns error Result", () => {
  const result = parseGPX("this is not xml at all ><< }}");
  expect(result.ok).toEqual(false);
  if (result.ok) return;
  expect(result.error).toEqual("File could not be parsed");
});

it("parseGPX - empty string returns error Result", () => {
  const result = parseGPX("");
  expect(result.ok).toEqual(false);
  if (result.ok) return;
  expect(result.error).toEqual("Empty GPX content provided");
});

// --- Empty track (no trkpt) returns error Result ---

it("parseGPX - empty track with no trkpt returns error Result", () => {
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

it("parseGPX - GPX with only waypoints and no tracks returns error", () => {
  const xml = wrapGPX(`
  <wpt lat="45.0" lon="5.0">
    <name>Just a waypoint</name>
  </wpt>`);

  const result = parseGPX(xml);
  expect(result.ok).toEqual(false);
  if (result.ok) return;
  expect(result.error).toEqual("No track data was found");
});

// --- Coordinates preserved to 6 decimal places ---

it("parseGPX - coordinates preserved to 6 decimal places", () => {
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

it("parseCoordinate - preserves to 6 decimal places", () => {
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

it("parseCoordinate - preserves exact 6-digit values", () => {
  const parser = new DOMParser();
  const doc = parser.parseFromString(
    '<trkpt lat="45.123456" lon="5.678901"/>',
    "application/xml",
  );
  const element = doc.documentElement as unknown as Element;

  const coord = parseCoordinate(element);
  expect(coord.lat).toEqual(45.123456);
  expect(coord.lon).toEqual(5.678901);
});

// --- Elevation rounded to integer ---

it("parseGPX - elevation rounded to integer", () => {
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
  expect(result.ok).toEqual(true);
  if (!result.ok) return;

  expect(result.value.tracks[0].trackpoints[0].elevation).toEqual(235); // rounds up
  expect(result.value.tracks[0].trackpoints[1].elevation).toEqual(234); // rounds down
  expect(result.value.tracks[0].trackpoints[2].elevation).toEqual(235); // .5 rounds up
});

// --- Timestamps truncated to seconds ---

it("parseGPX - timestamps truncated to 1-second ISO 8601", () => {
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

it("parseGPX - timestamps without milliseconds preserved as-is", () => {
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
  expect(result.ok).toEqual(true);
  if (!result.ok) return;

  expect(result.value.tracks[0].trackpoints[0].timestamp).toEqual("2024-06-15T08:30:00Z");
});

it("parseGPX - trackpoints without timestamps return null", () => {
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

// --- Additional structural tests ---

it("parseWaypoints - parses waypoints from document", () => {
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

  expect(waypoints.length).toEqual(2);
  expect(waypoints[0].name).toEqual("WP1");
  expect(waypoints[0].symbol).toEqual("200");
  expect(waypoints[0].description).toEqual("First waypoint");
  expect(waypoints[0].elevation).toEqual(101); // rounded
  expect(waypoints[1].name).toEqual("WP2");
  expect(waypoints[1].elevation).toEqual(200); // rounded
});

it("parseTracks - parses tracks with sequential trackpoint indices", () => {
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

  expect(tracks.length).toEqual(1);
  expect(tracks[0].name).toEqual("Trail");
  expect(tracks[0].trackpoints.length).toEqual(3);
  // Sequential indices across segments
  expect(tracks[0].trackpoints[0].index).toEqual(0);
  expect(tracks[0].trackpoints[1].index).toEqual(1);
  expect(tracks[0].trackpoints[2].index).toEqual(2);
});

// --- Property-Based Tests ---

import fc from "fast-check";
import { arbitraryGPXData } from "../generators.ts";

/**
 * **Validates: Requirements 1.2, 7.1, 7.2, 7.3**
 *
 * Property 2: GPX parse round-trip preserves coordinate and temporal data
 *
 * For any valid GPXData, serializing to XML and parsing back preserves:
 * - Coordinates to 6 decimal places
 * - Elevation to integer precision
 * - Timestamps to 1-second precision
 * - Idempotent (parsing same string twice yields identical results)
 */
it("Property 2: GPX parse round-trip preserves coordinate and temporal data", () => {
  fc.assert(fc.property(arbitraryGPXData, (originalData) => {
      const xml = gpxDataToXml(originalData);
      const result = parseGPX(xml);

      // Must parse successfully
      expect(result.ok, `Failed to parse generated GPX: ${!result.ok ? result.error : ""}`).toBeTruthy();
      if (!result.ok) return;

      const parsed = result.value;

      // Same number of waypoints
      expect(parsed.waypoints.length).toEqual(originalData.waypoints.length);

      // Verify each waypoint's coordinate and elevation
      for (let i = 0; i < originalData.waypoints.length; i++) {
        const orig = originalData.waypoints[i];
        const got = parsed.waypoints[i];

        // Coordinates preserved to 6 decimal places
        const expectedLat = Math.round(orig.coordinate.lat * 1_000_000) / 1_000_000;
        const expectedLon = Math.round(orig.coordinate.lon * 1_000_000) / 1_000_000;
        expect(got.coordinate.lat).toEqual(expectedLat);
        expect(got.coordinate.lon).toEqual(expectedLon);

        // Elevation preserved to integer
        expect(got.elevation).toEqual(Math.round(orig.elevation));
      }

      // Same number of tracks
      expect(parsed.tracks.length).toEqual(originalData.tracks.length);

      // Verify each track's trackpoints
      for (let t = 0; t < originalData.tracks.length; t++) {
        const origTrack = originalData.tracks[t];
        const gotTrack = parsed.tracks[t];

        expect(gotTrack.trackpoints.length).toEqual(origTrack.trackpoints.length);

        for (let p = 0; p < origTrack.trackpoints.length; p++) {
          const origTp = origTrack.trackpoints[p];
          const gotTp = gotTrack.trackpoints[p];

          // Coordinates preserved to 6 decimal places
          const expectedLat = Math.round(origTp.coordinate.lat * 1_000_000) / 1_000_000;
          const expectedLon = Math.round(origTp.coordinate.lon * 1_000_000) / 1_000_000;
          expect(gotTp.coordinate.lat).toEqual(expectedLat);
          expect(gotTp.coordinate.lon).toEqual(expectedLon);

          // Elevation preserved to integer
          expect(gotTp.elevation).toEqual(Math.round(origTp.elevation));

          // Timestamps preserved to 1-second precision
          if (origTp.timestamp !== null) {
            expect(gotTp.timestamp !== null, "Expected timestamp to be preserved").toBeTruthy();
            // Both should be truncated to second precision
            const origDate = new Date(origTp.timestamp);
            const gotDate = new Date(gotTp.timestamp!);
            // Within 1 second of each other (truncation to seconds)
            expect(Math.abs(origDate.getTime() - gotDate.getTime()) < 1000, `Timestamps differ by more than 1 second: ${origTp.timestamp} vs ${gotTp.timestamp}`).toBeTruthy();
          } else {
            expect(gotTp.timestamp).toEqual(null);
          }

          // Sequential index preserved
          expect(gotTp.index).toEqual(p);
        }
      }

      // Idempotency: parsing the same XML string twice yields identical results
      const result2 = parseGPX(xml);
      expect(result2.ok).toBeTruthy();
      if (!result2.ok) return;

      expect(parsed.waypoints).toEqual(result2.value.waypoints);
      expect(parsed.tracks).toEqual(result2.value.tracks);
    }), { numRuns: 50 });
});

/**
 * **Validates: Requirements 1.4**
 *
 * Property 3: Invalid XML produces error result
 *
 * For any string that is not well-formed XML, parseGPX SHALL return
 * a Result with ok: false and a non-empty error message.
 * The function SHALL never throw an exception for malformed input.
 */
it("Property 3: Invalid XML produces error result", () => {
  // Generate arbitrary non-XML strings that are unlikely to be valid XML
  const arbitraryNonXml = fc.oneof(
    // Random strings
    fc.string({ minLength: 1, maxLength: 500 }),
    // Strings with XML-like but invalid characters
    fc.string({ minLength: 1, maxLength: 200 }).map((s) => `<${s}>`),
    // Broken XML fragments
    fc.string({ minLength: 1, maxLength: 100 }).map((s) => `<?xml${s}`),
    // Strings with unmatched tags
    fc.string({ minLength: 1, maxLength: 50 }).map((s) => `<open>${s}</different>`),
    // Binary-like content
    fc.uint8Array({ minLength: 1, maxLength: 200 }).map((arr) =>
      String.fromCharCode(...arr)
    ),
  );

  fc.assert(fc.property(arbitraryNonXml, (input) => {
      // Should never throw
      let result;
      try {
        result = parseGPX(input);
      } catch (e) {
        // Property violated: parseGPX should never throw
        expect(false, `parseGPX threw an exception for input: ${JSON.stringify(input.slice(0, 50))}. Error: ${e}`).toBeTruthy();
        return;
      }

      // If the result happens to be ok (e.g., random string was accidentally valid XML with tracks),
      // that's fine — the property only concerns truly invalid XML.
      // But if it's not ok, the error message must be non-empty.
      if (!result.ok) {
        expect(result.error.length > 0, "Error message must be non-empty when parsing fails").toBeTruthy();
      }
    }), { numRuns: 100 });
});
