import type {
  Coordinate,
  GPXData,
  Result,
  Track,
  Trackpoint,
  Waypoint,
} from "../shared/types.ts";

/**
 * Parse a coordinate from a GPX element (wpt or trkpt).
 * Preserves latitude and longitude to 6 decimal places.
 *
 * @param element - An XML element with lat and lon attributes
 * @returns Coordinate with lat/lon rounded to 6 decimal places
 */
export function parseCoordinate(element: Element): Coordinate {
  const lat = parseFloat(element.getAttribute("lat") ?? "0");
  const lon = parseFloat(element.getAttribute("lon") ?? "0");
  return {
    lat: roundTo6Decimals(lat),
    lon: roundTo6Decimals(lon),
  };
}

/**
 * Parse all waypoints from a GPX document.
 * Extracts coordinate, elevation, name, symbol, and description from each <wpt> element.
 *
 * @param doc - A parsed GPX XML Document
 * @returns Array of Waypoint objects
 */
export function parseWaypoints(doc: Document): Waypoint[] {
  const wptElements = doc.getElementsByTagName("wpt");
  const waypoints: Waypoint[] = [];

  for (let i = 0; i < wptElements.length; i++) {
    const wpt = wptElements[i];
    const coordinate = parseCoordinate(wpt);
    const elevation = parseElevation(wpt);
    const name = getElementText(wpt, "name");
    const symbol = getElementText(wpt, "sym");
    const description = getElementText(wpt, "desc");

    waypoints.push({ coordinate, elevation, name, symbol, description });
  }

  return waypoints;
}

/**
 * Parse all tracks from a GPX document.
 * Each <trk> element becomes a Track with its name and all trackpoints
 * across all track segments (<trkseg>).
 *
 * @param doc - A parsed GPX XML Document
 * @returns Array of Track objects
 */
export function parseTracks(doc: Document): Track[] {
  const trkElements = doc.getElementsByTagName("trk");
  const tracks: Track[] = [];

  for (let i = 0; i < trkElements.length; i++) {
    const trk = trkElements[i];
    const name = getElementText(trk, "name");
    const trackpoints = parseTrackpoints(trk);

    tracks.push({ name, trackpoints });
  }

  return tracks;
}

/**
 * Parse a GPX XML string into structured GPXData.
 *
 * Returns a Result type: ok with GPXData on success, or error with message on failure.
 * Never throws exceptions — all errors are captured in the Result.
 *
 * Validates:
 * - The XML is well-formed
 * - At least one track with trackpoints exists
 *
 * @param xmlString - Raw GPX XML content
 * @returns Result<GPXData> — either success with parsed data or error with message
 */
export function parseGPX(xmlString: string): Result<GPXData> {
  // Handle empty/whitespace-only input
  if (!xmlString || xmlString.trim().length === 0) {
    return { ok: false, error: "Empty GPX content provided" };
  }

  let doc: Document;
  try {
    const parser = new DOMParser();
    doc = parser.parseFromString(xmlString, "application/xml");
  } catch {
    return { ok: false, error: "Failed to parse XML content" };
  }

  // Check for XML parsing errors (DOMParser puts <parsererror> in the document)
  const parserError = doc.getElementsByTagName("parsererror");
  if (parserError.length > 0) {
    return { ok: false, error: "File could not be parsed" };
  }

  const waypoints = parseWaypoints(doc);
  const tracks = parseTracks(doc);

  // Validate that there is at least one track with trackpoints
  const totalTrackpoints = tracks.reduce(
    (sum, track) => sum + track.trackpoints.length,
    0,
  );

  if (totalTrackpoints === 0) {
    return { ok: false, error: "No track data was found" };
  }

  return { ok: true, value: { waypoints, tracks } };
}

// --- Internal helpers ---

/**
 * Parse all trackpoints from a <trk> element, across all <trkseg> children.
 * Trackpoints are indexed sequentially starting at 0.
 */
function parseTrackpoints(trkElement: Element): Trackpoint[] {
  const trkptElements = trkElement.getElementsByTagName("trkpt");
  const trackpoints: Trackpoint[] = [];

  for (let i = 0; i < trkptElements.length; i++) {
    const trkpt = trkptElements[i];
    const coordinate = parseCoordinate(trkpt);
    const elevation = parseElevation(trkpt);
    const timestamp = parseTimestamp(trkpt);

    trackpoints.push({
      coordinate,
      elevation,
      timestamp,
      index: i,
    });
  }

  return trackpoints;
}

/**
 * Parse elevation from an element, rounding to integer precision.
 * Returns 0 if no <ele> child is found or the value is not a valid number.
 */
function parseElevation(element: Element): number {
  const eleText = getElementText(element, "ele");
  if (!eleText) return 0;
  const value = parseFloat(eleText);
  if (isNaN(value)) return 0;
  return Math.round(value);
}

/**
 * Parse timestamp from a trackpoint element.
 * Returns ISO 8601 string truncated to 1-second precision, or null if absent.
 */
function parseTimestamp(element: Element): string | null {
  const timeText = getElementText(element, "time");
  if (!timeText) return null;

  const date = new Date(timeText);
  if (isNaN(date.getTime())) return null;

  // Truncate to 1-second precision: remove milliseconds
  // Output format: YYYY-MM-DDTHH:mm:ssZ
  return date.toISOString().replace(/\.\d{3}Z$/, "Z");
}

/**
 * Get the text content of a direct child element by tag name.
 * Returns empty string if the child element is not found.
 */
function getElementText(parent: Element, tagName: string): string {
  const elements = parent.getElementsByTagName(tagName);
  if (elements.length === 0) return "";
  return elements[0].textContent?.trim() ?? "";
}

/**
 * Round a number to 6 decimal places.
 */
function roundTo6Decimals(value: number): number {
  return Math.round(value * 1_000_000) / 1_000_000;
}
