import { assertEquals } from "@std/assert";
import {
  classifyWaypoint,
  classifyWaypoints,
  DEFAULT_PATTERNS,
  detectByWaypoint,
  validateSwimPairing,
} from "./waypoint-classifier.ts";
import type {
  ClassifiedWaypoint,
  Trackpoint,
  Waypoint,
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

Deno.test("classifyWaypoint - name 'début swim' (lowercase) → swim-start (case-insensitive)", () => {
  const wp = makeWaypoint({ name: "début swim 1" });
  assertEquals(classifyWaypoint(wp), "swim-start");
});

Deno.test("classifyWaypoint - name 'swim start' → swim-start", () => {
  const wp = makeWaypoint({ name: "swim start" });
  assertEquals(classifyWaypoint(wp), "swim-start");
});

Deno.test("classifyWaypoint - name 'Swim Entry Point' → swim-start", () => {
  const wp = makeWaypoint({ name: "Swim Entry Point" });
  assertEquals(classifyWaypoint(wp), "swim-start");
});

Deno.test("classifyWaypoint - name 'Water Entry' → swim-start", () => {
  const wp = makeWaypoint({ name: "Water Entry" });
  assertEquals(classifyWaypoint(wp), "swim-start");
});

Deno.test("classifyWaypoint - name 'Start Swim 3' → swim-start", () => {
  const wp = makeWaypoint({ name: "Start Swim 3" });
  assertEquals(classifyWaypoint(wp), "swim-start");
});

Deno.test("classifyWaypoint - name 'Zwem Start' → swim-start", () => {
  const wp = makeWaypoint({ name: "Zwem Start" });
  assertEquals(classifyWaypoint(wp), "swim-start");
});

Deno.test("classifyWaypoint - name 'Begin Zwem' → swim-start", () => {
  const wp = makeWaypoint({ name: "Begin Zwem" });
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

Deno.test("classifyWaypoint - name 'Swim End' → swim-end", () => {
  const wp = makeWaypoint({ name: "Swim End" });
  assertEquals(classifyWaypoint(wp), "swim-end");
});

Deno.test("classifyWaypoint - name 'Swim Exit' → swim-end", () => {
  const wp = makeWaypoint({ name: "Swim Exit" });
  assertEquals(classifyWaypoint(wp), "swim-end");
});

Deno.test("classifyWaypoint - name 'Water Exit' → swim-end", () => {
  const wp = makeWaypoint({ name: "Water Exit" });
  assertEquals(classifyWaypoint(wp), "swim-end");
});

Deno.test("classifyWaypoint - name 'End Swim 2' → swim-end", () => {
  const wp = makeWaypoint({ name: "End Swim 2" });
  assertEquals(classifyWaypoint(wp), "swim-end");
});

Deno.test("classifyWaypoint - name 'Zwem Eind' → swim-end", () => {
  const wp = makeWaypoint({ name: "Zwem Eind" });
  assertEquals(classifyWaypoint(wp), "swim-end");
});

Deno.test("classifyWaypoint - name 'Einde Zwem' → swim-end", () => {
  const wp = makeWaypoint({ name: "Einde Zwem" });
  assertEquals(classifyWaypoint(wp), "swim-end");
});

Deno.test("classifyWaypoint - sym 3 → aid-station", () => {
  const wp = makeWaypoint({ symbol: "3" });
  assertEquals(classifyWaypoint(wp), "aid-station");
});

Deno.test("classifyWaypoint - sym 49 → aid-station", () => {
  const wp = makeWaypoint({ symbol: "49" });
  assertEquals(classifyWaypoint(wp), "aid-station");
});

Deno.test("classifyWaypoint - name containing 'Ravitaillement' (case-insensitive) → aid-station", () => {
  const wp = makeWaypoint({ name: "RAVITAILLEMENT 2" });
  assertEquals(classifyWaypoint(wp), "aid-station");
});

Deno.test("classifyWaypoint - name 'Aid Station 1' → aid-station", () => {
  const wp = makeWaypoint({ name: "Aid Station 1" });
  assertEquals(classifyWaypoint(wp), "aid-station");
});

Deno.test("classifyWaypoint - name 'Feed Zone' → aid-station", () => {
  const wp = makeWaypoint({ name: "Feed Zone" });
  assertEquals(classifyWaypoint(wp), "aid-station");
});

Deno.test("classifyWaypoint - name 'Energy Post' → aid-station", () => {
  const wp = makeWaypoint({ name: "Energy Post" });
  assertEquals(classifyWaypoint(wp), "aid-station");
});

Deno.test("classifyWaypoint - name 'Food Station' → aid-station", () => {
  const wp = makeWaypoint({ name: "Food Station" });
  assertEquals(classifyWaypoint(wp), "aid-station");
});

Deno.test("classifyWaypoint - name 'Drink Point' → aid-station", () => {
  const wp = makeWaypoint({ name: "Drink Point" });
  assertEquals(classifyWaypoint(wp), "aid-station");
});

Deno.test("classifyWaypoint - name 'Verzorging' → aid-station", () => {
  const wp = makeWaypoint({ name: "Verzorging" });
  assertEquals(classifyWaypoint(wp), "aid-station");
});

Deno.test("classifyWaypoint - name 'Voeding' → aid-station", () => {
  const wp = makeWaypoint({ name: "Voeding" });
  assertEquals(classifyWaypoint(wp), "aid-station");
});

Deno.test("classifyWaypoint - name 'Verpflegung' → aid-station", () => {
  const wp = makeWaypoint({ name: "Verpflegung" });
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

Deno.test("classifyWaypoint - name 'Début SWIM' exactly → swim-start", () => {
  const wp = makeWaypoint({ name: "Début SWIM" });
  assertEquals(classifyWaypoint(wp), "swim-start");
});

// --- DEFAULT_PATTERNS ---

Deno.test("DEFAULT_PATTERNS - is exported and has all categories", () => {
  assertEquals(Array.isArray(DEFAULT_PATTERNS.swimStart.symValues), true);
  assertEquals(Array.isArray(DEFAULT_PATTERNS.swimStart.nameContains), true);
  assertEquals(Array.isArray(DEFAULT_PATTERNS.swimEnd.symValues), true);
  assertEquals(Array.isArray(DEFAULT_PATTERNS.swimEnd.nameContains), true);
  assertEquals(Array.isArray(DEFAULT_PATTERNS.aidStation.symValues), true);
  assertEquals(Array.isArray(DEFAULT_PATTERNS.aidStation.nameContains), true);
});

Deno.test("classifyWaypoint - custom patterns override defaults", () => {
  const customPatterns = {
    ...DEFAULT_PATTERNS,
    swimStart: {
      symValues: ["999"],
      nameContains: ["custom swim begin"],
    },
  };
  // Default sym 200 should NOT match with custom patterns
  const wp1 = makeWaypoint({ symbol: "200" });
  assertEquals(classifyWaypoint(wp1, customPatterns), "other");

  // Custom sym 999 should match
  const wp2 = makeWaypoint({ symbol: "999" });
  assertEquals(classifyWaypoint(wp2, customPatterns), "swim-start");

  // Custom name pattern should match
  const wp3 = makeWaypoint({ name: "Custom Swim Begin Here" });
  assertEquals(classifyWaypoint(wp3, customPatterns), "swim-start");
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

Deno.test("validateSwimPairing - more ends than starts is valid (extra ends ignored)", () => {
  const classified: ClassifiedWaypoint[] = [
    { waypoint: makeWaypoint({ symbol: "200" }), type: "swim-start" },
    { waypoint: makeWaypoint({ symbol: "201" }), type: "swim-end" },
    { waypoint: makeWaypoint({ symbol: "201" }), type: "swim-end" },
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
  assertEquals(result.segments[0].confidenceScore, 0.95);
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

Deno.test("detectByWaypoint - confidence is 0.95", () => {
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
    assertEquals(seg.confidenceScore, 0.95);
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

Deno.test("detectByWaypoint - validates pairing and excludes unpaired starts", () => {
  const trackpoints: Trackpoint[] = [];
  for (let i = 0; i < 10; i++) {
    trackpoints.push(makeTrackpoint(i, 45.0 + i * 0.0001, 5.0));
  }
  // Two starts but only one end — only the first pair should be used
  const waypoints = [
    makeWaypoint({ symbol: "200", coordinate: { lat: 45.0002, lon: 5.0 } }),
    makeWaypoint({ symbol: "201", coordinate: { lat: 45.0005, lon: 5.0 } }),
    makeWaypoint({ symbol: "200", coordinate: { lat: 45.0008, lon: 5.0 } }),
  ];
  const result = detectByWaypoint(waypoints, trackpoints);
  // Should still produce segments for the valid pair
  const swimSegments = result.segments.filter((s) => s.type === "swim");
  assertEquals(swimSegments.length, 1);
});
