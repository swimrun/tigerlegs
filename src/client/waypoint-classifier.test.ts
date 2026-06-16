import { assertEquals } from "@std/assert";
import {
  classifyWaypoint,
  classifyWaypoints,
  validateSwimPairing,
  detectByWaypoint,
} from "./waypoint-classifier.ts";
import type {
  Waypoint,
  Trackpoint,
  ClassifiedWaypoint,
} from "../shared/types.ts";

// --- Helpers ---

function makeWaypoint(
  overrides: Partial<Waypoint> = {},
): Waypoint {
  return {
    coordinate: { lat: 45.0, lon: 5.0 },
    elevation: 100,
    name: "",
    symbol: "",
    description: "",
    ...overrides,
  };
}

function makeTrackpoint(
  index: number,
  lat: number,
  lon: number,
): Trackpoint {
  return {
    coordinate: { lat, lon },
    elevation: 100,
    timestamp: null,
    index,
  };
}

// --- classifyWaypoint ---

Deno.test("classifyWaypoint - sym 200 → swim-start", () => {
  const wp = makeWaypoint({ symbol: "200" });
  assertEquals(classifyWaypoint(wp), "swim-start");
});

Deno.test("classifyWaypoint - name 'Début SWIM 1' → swim-start", () => {
  const wp = makeWaypoint({ name: "Début SWIM 1" });
  assertEquals(classifyWaypoint(wp), "swim-start");
});

Deno.test("classifyWaypoint - sym 201 → swim-end", () => {
  const wp = makeWaypoint({ symbol: "201" });
  assertEquals(classifyWaypoint(wp), "swim-end");
});

Deno.test("classifyWaypoint - name 'Fin SWIM 1' → swim-end", () => {
  const wp = makeWaypoint({ name: "Fin SWIM 1" });
  assertEquals(classifyWaypoint(wp), "swim-end");
});

Deno.test("classifyWaypoint - sym 3 → aid-station", () => {
  const wp = makeWaypoint({ symbol: "3" });
  assertEquals(classifyWaypoint(wp), "aid-station");
});

Deno.test("classifyWaypoint - name containing 'Ravitaillement' (case-insensitive) → aid-station", () => {
  const wp = makeWaypoint({ name: "RAVITAILLEMENT 2" });
  assertEquals(classifyWaypoint(wp), "aid-station");
});

Deno.test("classifyWaypoint - unrecognized waypoint → other", () => {
  const wp = makeWaypoint({ symbol: "99", name: "Random Point" });
  assertEquals(classifyWaypoint(wp), "other");
});

Deno.test("classifyWaypoint - sym takes priority (sym=200 with non-matching name)", () => {
  const wp = makeWaypoint({ symbol: "200", name: "Some checkpoint" });
  assertEquals(classifyWaypoint(wp), "swim-start");
});

Deno.test("classifyWaypoint - name 'Début SWIM' exactly → swim-start (prefix match)", () => {
  const wp = makeWaypoint({ name: "Début SWIM" });
  assertEquals(classifyWaypoint(wp), "swim-start");
});

Deno.test("classifyWaypoint - name 'début swim' (lowercase) → not swim-start (case-sensitive)", () => {
  const wp = makeWaypoint({ name: "début swim 1" });
  assertEquals(classifyWaypoint(wp), "other");
});

// --- classifyWaypoints ---

Deno.test("classifyWaypoints - filters out 'other' waypoints", () => {
  const waypoints = [
    makeWaypoint({ symbol: "200" }),
    makeWaypoint({ symbol: "99", name: "Random" }),
    makeWaypoint({ symbol: "201" }),
    makeWaypoint({ symbol: "3" }),
  ];
  const classified = classifyWaypoints(waypoints);
  assertEquals(classified.length, 3);
  assertEquals(classified[0].type, "swim-start");
  assertEquals(classified[1].type, "swim-end");
  assertEquals(classified[2].type, "aid-station");
});

Deno.test("classifyWaypoints - preserves file-appearance order", () => {
  const waypoints = [
    makeWaypoint({ symbol: "201", name: "End 1" }),
    makeWaypoint({ symbol: "200", name: "Start 1" }),
  ];
  const classified = classifyWaypoints(waypoints);
  assertEquals(classified[0].type, "swim-end");
  assertEquals(classified[1].type, "swim-start");
});

// --- validateSwimPairing ---

Deno.test("validateSwimPairing - equal pairs is valid", () => {
  const classified: ClassifiedWaypoint[] = [
    { waypoint: makeWaypoint({ symbol: "200" }), type: "swim-start" },
    { waypoint: makeWaypoint({ symbol: "201" }), type: "swim-end" },
  ];
  const result = validateSwimPairing(classified);
  assertEquals(result.valid, true);
});

Deno.test("validateSwimPairing - more starts than ends is invalid", () => {
  const classified: ClassifiedWaypoint[] = [
    { waypoint: makeWaypoint({ symbol: "200" }), type: "swim-start" },
    { waypoint: makeWaypoint({ symbol: "200" }), type: "swim-start" },
    { waypoint: makeWaypoint({ symbol: "201" }), type: "swim-end" },
  ];
  const result = validateSwimPairing(classified);
  assertEquals(result.valid, false);
  assertEquals(typeof result.error, "string");
});

Deno.test("validateSwimPairing - no swim waypoints is valid", () => {
  const classified: ClassifiedWaypoint[] = [
    { waypoint: makeWaypoint({ symbol: "3" }), type: "aid-station" },
  ];
  const result = validateSwimPairing(classified);
  assertEquals(result.valid, true);
});

// --- detectByWaypoint ---

Deno.test("detectByWaypoint - no swim waypoints → single run segment", () => {
  const waypoints = [makeWaypoint({ symbol: "3" })];
  const trackpoints = [
    makeTrackpoint(0, 45.0, 5.0),
    makeTrackpoint(1, 45.001, 5.001),
    makeTrackpoint(2, 45.002, 5.002),
  ];
  const result = detectByWaypoint(waypoints, trackpoints);
  assertEquals(result.strategy, "waypoint");
  assertEquals(result.segments.length, 1);
  assertEquals(result.segments[0].type, "run");
  assertEquals(result.segments[0].startTrackpointIndex, 0);
  assertEquals(result.segments[0].endTrackpointIndex, 2);
  assertEquals(result.segments[0].confidenceScore, 1.0);
});

Deno.test("detectByWaypoint - one swim pair produces run-swim-run", () => {
  // Trackpoints along a straight line
  const trackpoints: Trackpoint[] = [];
  for (let i = 0; i < 10; i++) {
    trackpoints.push(makeTrackpoint(i, 45.0 + i * 0.0001, 5.0));
  }
  // Swim start near trackpoint 3, swim end near trackpoint 6
  const waypoints = [
    makeWaypoint({ symbol: "200", coordinate: { lat: 45.0003, lon: 5.0 } }),
    makeWaypoint({ symbol: "201", coordinate: { lat: 45.0006, lon: 5.0 } }),
  ];
  const result = detectByWaypoint(waypoints, trackpoints);
  assertEquals(result.strategy, "waypoint");
  assertEquals(result.segments.length, 3);

  // First run: 0 to before swim start
  assertEquals(result.segments[0].type, "run");
  assertEquals(result.segments[0].startTrackpointIndex, 0);

  // Swim segment
  assertEquals(result.segments[1].type, "swim");
  assertEquals(result.segments[1].startTrackpointIndex, 3);
  assertEquals(result.segments[1].endTrackpointIndex, 6);

  // Final run
  assertEquals(result.segments[2].type, "run");
  assertEquals(result.segments[2].endTrackpointIndex, 9);
});

Deno.test("detectByWaypoint - race starting with swim (no preceding run)", () => {
  const trackpoints: Trackpoint[] = [];
  for (let i = 0; i < 10; i++) {
    trackpoints.push(makeTrackpoint(i, 45.0 + i * 0.0001, 5.0));
  }
  // Swim start at trackpoint 0, swim end near trackpoint 4
  const waypoints = [
    makeWaypoint({ symbol: "200", coordinate: { lat: 45.0, lon: 5.0 } }),
    makeWaypoint({ symbol: "201", coordinate: { lat: 45.0004, lon: 5.0 } }),
  ];
  const result = detectByWaypoint(waypoints, trackpoints);
  // Should start with swim, no preceding run
  assertEquals(result.segments[0].type, "swim");
  assertEquals(result.segments[0].startTrackpointIndex, 0);
  assertEquals(result.segments[0].endTrackpointIndex, 4);
  // Trailing run
  assertEquals(result.segments[1].type, "run");
  assertEquals(result.segments[1].startTrackpointIndex, 5);
  assertEquals(result.segments[1].endTrackpointIndex, 9);
});

Deno.test("detectByWaypoint - confidence is 1.0 (authoritative)", () => {
  const trackpoints: Trackpoint[] = [];
  for (let i = 0; i < 5; i++) {
    trackpoints.push(makeTrackpoint(i, 45.0 + i * 0.0001, 5.0));
  }
  const waypoints = [
    makeWaypoint({ symbol: "200", coordinate: { lat: 45.0001, lon: 5.0 } }),
    makeWaypoint({ symbol: "201", coordinate: { lat: 45.0003, lon: 5.0 } }),
  ];
  const result = detectByWaypoint(waypoints, trackpoints);
  for (const seg of result.segments) {
    assertEquals(seg.confidenceScore, 1.0);
  }
});

Deno.test("detectByWaypoint - empty trackpoints → no segments", () => {
  const waypoints = [
    makeWaypoint({ symbol: "200" }),
    makeWaypoint({ symbol: "201" }),
  ];
  const result = detectByWaypoint(waypoints, []);
  assertEquals(result.segments.length, 0);
});

Deno.test("detectByWaypoint - waypoint too far from track (>50m) → skipped pair", () => {
  const trackpoints = [
    makeTrackpoint(0, 45.0, 5.0),
    makeTrackpoint(1, 45.001, 5.0),
    makeTrackpoint(2, 45.002, 5.0),
  ];
  // Waypoint very far away (different lat entirely)
  const waypoints = [
    makeWaypoint({ symbol: "200", coordinate: { lat: 46.0, lon: 5.0 } }),
    makeWaypoint({ symbol: "201", coordinate: { lat: 46.0, lon: 5.001 } }),
  ];
  const result = detectByWaypoint(waypoints, trackpoints);
  // Should produce a single run since the swim pair can't be mapped
  assertEquals(result.segments.length, 1);
  assertEquals(result.segments[0].type, "run");
  assertEquals(result.segments[0].startTrackpointIndex, 0);
  assertEquals(result.segments[0].endTrackpointIndex, 2);
});

Deno.test("detectByWaypoint - multiple swim pairs in correct order", () => {
  const trackpoints: Trackpoint[] = [];
  for (let i = 0; i < 20; i++) {
    trackpoints.push(makeTrackpoint(i, 45.0 + i * 0.0001, 5.0));
  }
  const waypoints = [
    makeWaypoint({ symbol: "200", coordinate: { lat: 45.0002, lon: 5.0 } }),
    makeWaypoint({ symbol: "201", coordinate: { lat: 45.0005, lon: 5.0 } }),
    makeWaypoint({ symbol: "200", coordinate: { lat: 45.0010, lon: 5.0 } }),
    makeWaypoint({ symbol: "201", coordinate: { lat: 45.0015, lon: 5.0 } }),
  ];
  const result = detectByWaypoint(waypoints, trackpoints);
  // Expected: run, swim, run, swim, run
  assertEquals(result.segments.length, 5);
  assertEquals(result.segments[0].type, "run");
  assertEquals(result.segments[1].type, "swim");
  assertEquals(result.segments[2].type, "run");
  assertEquals(result.segments[3].type, "swim");
  assertEquals(result.segments[4].type, "run");
});
