import { expect, it } from "vitest";
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

it("classifyWaypoint - sym 200 → swim-start", () => {
  const wp = makeWaypoint({ symbol: "200" });
  expect(classifyWaypoint(wp)).toEqual("swim-start");
});

it("classifyWaypoint - name 'Début SWIM 1' → swim-start", () => {
  const wp = makeWaypoint({ name: "Début SWIM 1" });
  expect(classifyWaypoint(wp)).toEqual("swim-start");
});

it("classifyWaypoint - name 'début swim' (lowercase) → swim-start (case-insensitive)", () => {
  const wp = makeWaypoint({ name: "début swim 1" });
  expect(classifyWaypoint(wp)).toEqual("swim-start");
});

it("classifyWaypoint - name 'swim start' → swim-start", () => {
  const wp = makeWaypoint({ name: "swim start" });
  expect(classifyWaypoint(wp)).toEqual("swim-start");
});

it("classifyWaypoint - name 'Swim Entry Point' → swim-start", () => {
  const wp = makeWaypoint({ name: "Swim Entry Point" });
  expect(classifyWaypoint(wp)).toEqual("swim-start");
});

it("classifyWaypoint - name 'Water Entry' → swim-start", () => {
  const wp = makeWaypoint({ name: "Water Entry" });
  expect(classifyWaypoint(wp)).toEqual("swim-start");
});

it("classifyWaypoint - name 'Start Swim 3' → swim-start", () => {
  const wp = makeWaypoint({ name: "Start Swim 3" });
  expect(classifyWaypoint(wp)).toEqual("swim-start");
});

it("classifyWaypoint - name 'Zwem Start' → swim-start", () => {
  const wp = makeWaypoint({ name: "Zwem Start" });
  expect(classifyWaypoint(wp)).toEqual("swim-start");
});

it("classifyWaypoint - name 'Begin Zwem' → swim-start", () => {
  const wp = makeWaypoint({ name: "Begin Zwem" });
  expect(classifyWaypoint(wp)).toEqual("swim-start");
});

it("classifyWaypoint - sym 201 → swim-end", () => {
  const wp = makeWaypoint({ symbol: "201" });
  expect(classifyWaypoint(wp)).toEqual("swim-end");
});

it("classifyWaypoint - name 'Fin SWIM 1' → swim-end", () => {
  const wp = makeWaypoint({ name: "Fin SWIM 1" });
  expect(classifyWaypoint(wp)).toEqual("swim-end");
});

it("classifyWaypoint - name 'Swim End' → swim-end", () => {
  const wp = makeWaypoint({ name: "Swim End" });
  expect(classifyWaypoint(wp)).toEqual("swim-end");
});

it("classifyWaypoint - name 'Swim Exit' → swim-end", () => {
  const wp = makeWaypoint({ name: "Swim Exit" });
  expect(classifyWaypoint(wp)).toEqual("swim-end");
});

it("classifyWaypoint - name 'Water Exit' → swim-end", () => {
  const wp = makeWaypoint({ name: "Water Exit" });
  expect(classifyWaypoint(wp)).toEqual("swim-end");
});

it("classifyWaypoint - name 'End Swim 2' → swim-end", () => {
  const wp = makeWaypoint({ name: "End Swim 2" });
  expect(classifyWaypoint(wp)).toEqual("swim-end");
});

it("classifyWaypoint - name 'Zwem Eind' → swim-end", () => {
  const wp = makeWaypoint({ name: "Zwem Eind" });
  expect(classifyWaypoint(wp)).toEqual("swim-end");
});

it("classifyWaypoint - name 'Einde Zwem' → swim-end", () => {
  const wp = makeWaypoint({ name: "Einde Zwem" });
  expect(classifyWaypoint(wp)).toEqual("swim-end");
});

it("classifyWaypoint - sym 3 → aid-station", () => {
  const wp = makeWaypoint({ symbol: "3" });
  expect(classifyWaypoint(wp)).toEqual("aid-station");
});

it("classifyWaypoint - sym 49 → aid-station", () => {
  const wp = makeWaypoint({ symbol: "49" });
  expect(classifyWaypoint(wp)).toEqual("aid-station");
});

it("classifyWaypoint - name containing 'Ravitaillement' (case-insensitive) → aid-station", () => {
  const wp = makeWaypoint({ name: "RAVITAILLEMENT 2" });
  expect(classifyWaypoint(wp)).toEqual("aid-station");
});

it("classifyWaypoint - name 'Aid Station 1' → aid-station", () => {
  const wp = makeWaypoint({ name: "Aid Station 1" });
  expect(classifyWaypoint(wp)).toEqual("aid-station");
});

it("classifyWaypoint - name 'Feed Zone' → aid-station", () => {
  const wp = makeWaypoint({ name: "Feed Zone" });
  expect(classifyWaypoint(wp)).toEqual("aid-station");
});

it("classifyWaypoint - name 'Energy Post' → aid-station", () => {
  const wp = makeWaypoint({ name: "Energy Post" });
  expect(classifyWaypoint(wp)).toEqual("aid-station");
});

it("classifyWaypoint - name 'Food Station' → aid-station", () => {
  const wp = makeWaypoint({ name: "Food Station" });
  expect(classifyWaypoint(wp)).toEqual("aid-station");
});

it("classifyWaypoint - name 'Drink Point' → aid-station", () => {
  const wp = makeWaypoint({ name: "Drink Point" });
  expect(classifyWaypoint(wp)).toEqual("aid-station");
});

it("classifyWaypoint - name 'Verzorging' → aid-station", () => {
  const wp = makeWaypoint({ name: "Verzorging" });
  expect(classifyWaypoint(wp)).toEqual("aid-station");
});

it("classifyWaypoint - name 'Voeding' → aid-station", () => {
  const wp = makeWaypoint({ name: "Voeding" });
  expect(classifyWaypoint(wp)).toEqual("aid-station");
});

it("classifyWaypoint - name 'Verpflegung' → aid-station", () => {
  const wp = makeWaypoint({ name: "Verpflegung" });
  expect(classifyWaypoint(wp)).toEqual("aid-station");
});

it("classifyWaypoint - unrecognized waypoint → other", () => {
  const wp = makeWaypoint({ symbol: "99", name: "Random Point" });
  expect(classifyWaypoint(wp)).toEqual("other");
});

it("classifyWaypoint - sym takes priority (sym=200 with non-matching name)", () => {
  const wp = makeWaypoint({ symbol: "200", name: "Some checkpoint" });
  expect(classifyWaypoint(wp)).toEqual("swim-start");
});

it("classifyWaypoint - name 'Début SWIM' exactly → swim-start", () => {
  const wp = makeWaypoint({ name: "Début SWIM" });
  expect(classifyWaypoint(wp)).toEqual("swim-start");
});

// --- DEFAULT_PATTERNS ---

it("DEFAULT_PATTERNS - is exported and has all categories", () => {
  expect(Array.isArray(DEFAULT_PATTERNS.swimStart.symValues)).toEqual(true);
  expect(Array.isArray(DEFAULT_PATTERNS.swimStart.nameContains)).toEqual(true);
  expect(Array.isArray(DEFAULT_PATTERNS.swimEnd.symValues)).toEqual(true);
  expect(Array.isArray(DEFAULT_PATTERNS.swimEnd.nameContains)).toEqual(true);
  expect(Array.isArray(DEFAULT_PATTERNS.aidStation.symValues)).toEqual(true);
  expect(Array.isArray(DEFAULT_PATTERNS.aidStation.nameContains)).toEqual(true);
});

it("classifyWaypoint - custom patterns override defaults", () => {
  const customPatterns = {
    ...DEFAULT_PATTERNS,
    swimStart: {
      symValues: ["999"],
      nameContains: ["custom swim begin"],
    },
  };
  // Default sym 200 should NOT match with custom patterns
  const wp1 = makeWaypoint({ symbol: "200" });
  expect(classifyWaypoint(wp1, customPatterns)).toEqual("other");

  // Custom sym 999 should match
  const wp2 = makeWaypoint({ symbol: "999" });
  expect(classifyWaypoint(wp2, customPatterns)).toEqual("swim-start");

  // Custom name pattern should match
  const wp3 = makeWaypoint({ name: "Custom Swim Begin Here" });
  expect(classifyWaypoint(wp3, customPatterns)).toEqual("swim-start");
});

// --- classifyWaypoints ---

it("classifyWaypoints - filters out 'other' waypoints", () => {
  const waypoints = [
    makeWaypoint({ symbol: "200" }),
    makeWaypoint({ symbol: "99", name: "Random" }),
    makeWaypoint({ symbol: "201" }),
    makeWaypoint({ symbol: "3" }),
  ];
  const classified = classifyWaypoints(waypoints);
  expect(classified.length).toEqual(3);
  expect(classified[0].type).toEqual("swim-start");
  expect(classified[1].type).toEqual("swim-end");
  expect(classified[2].type).toEqual("aid-station");
});

it("classifyWaypoints - preserves file-appearance order", () => {
  const waypoints = [
    makeWaypoint({ symbol: "201", name: "End 1" }),
    makeWaypoint({ symbol: "200", name: "Start 1" }),
  ];
  const classified = classifyWaypoints(waypoints);
  expect(classified[0].type).toEqual("swim-end");
  expect(classified[1].type).toEqual("swim-start");
});

// --- validateSwimPairing ---

it("validateSwimPairing - equal pairs is valid", () => {
  const classified: ClassifiedWaypoint[] = [
    { waypoint: makeWaypoint({ symbol: "200" }), type: "swim-start" },
    { waypoint: makeWaypoint({ symbol: "201" }), type: "swim-end" },
  ];
  const result = validateSwimPairing(classified);
  expect(result.valid).toEqual(true);
});

it("validateSwimPairing - more starts than ends is invalid", () => {
  const classified: ClassifiedWaypoint[] = [
    { waypoint: makeWaypoint({ symbol: "200" }), type: "swim-start" },
    { waypoint: makeWaypoint({ symbol: "200" }), type: "swim-start" },
    { waypoint: makeWaypoint({ symbol: "201" }), type: "swim-end" },
  ];
  const result = validateSwimPairing(classified);
  expect(result.valid).toEqual(false);
  expect(typeof result.error).toEqual("string");
});

it("validateSwimPairing - no swim waypoints is valid", () => {
  const classified: ClassifiedWaypoint[] = [
    { waypoint: makeWaypoint({ symbol: "3" }), type: "aid-station" },
  ];
  const result = validateSwimPairing(classified);
  expect(result.valid).toEqual(true);
});

it("validateSwimPairing - more ends than starts is valid (extra ends ignored)", () => {
  const classified: ClassifiedWaypoint[] = [
    { waypoint: makeWaypoint({ symbol: "200" }), type: "swim-start" },
    { waypoint: makeWaypoint({ symbol: "201" }), type: "swim-end" },
    { waypoint: makeWaypoint({ symbol: "201" }), type: "swim-end" },
  ];
  const result = validateSwimPairing(classified);
  expect(result.valid).toEqual(true);
});

// --- detectByWaypoint ---

it("detectByWaypoint - no swim waypoints → single run segment", () => {
  const waypoints = [makeWaypoint({ symbol: "3" })];
  const trackpoints = [
    makeTrackpoint(0, 45.0, 5.0),
    makeTrackpoint(1, 45.001, 5.001),
    makeTrackpoint(2, 45.002, 5.002),
  ];
  const result = detectByWaypoint(waypoints, trackpoints);
  expect(result.strategy).toEqual("waypoint");
  expect(result.segments.length).toEqual(1);
  expect(result.segments[0].type).toEqual("run");
  expect(result.segments[0].startTrackpointIndex).toEqual(0);
  expect(result.segments[0].endTrackpointIndex).toEqual(2);
  expect(result.segments[0].confidenceScore).toEqual(0.95);
});

it("detectByWaypoint - one swim pair produces run-swim-run", () => {
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
  expect(result.strategy).toEqual("waypoint");
  expect(result.segments.length).toEqual(3);

  // First run: 0 to before swim start
  expect(result.segments[0].type).toEqual("run");
  expect(result.segments[0].startTrackpointIndex).toEqual(0);

  // Swim segment
  expect(result.segments[1].type).toEqual("swim");
  expect(result.segments[1].startTrackpointIndex).toEqual(3);
  expect(result.segments[1].endTrackpointIndex).toEqual(6);

  // Final run
  expect(result.segments[2].type).toEqual("run");
  expect(result.segments[2].endTrackpointIndex).toEqual(9);
});

it("detectByWaypoint - race starting with swim (no preceding run)", () => {
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
  expect(result.segments[0].type).toEqual("swim");
  expect(result.segments[0].startTrackpointIndex).toEqual(0);
  expect(result.segments[0].endTrackpointIndex).toEqual(4);
  // Trailing run
  expect(result.segments[1].type).toEqual("run");
  expect(result.segments[1].startTrackpointIndex).toEqual(5);
  expect(result.segments[1].endTrackpointIndex).toEqual(9);
});

it("detectByWaypoint - confidence is 0.95", () => {
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
    expect(seg.confidenceScore).toEqual(0.95);
  }
});

it("detectByWaypoint - empty trackpoints → no segments", () => {
  const waypoints = [
    makeWaypoint({ symbol: "200" }),
    makeWaypoint({ symbol: "201" }),
  ];
  const result = detectByWaypoint(waypoints, []);
  expect(result.segments.length).toEqual(0);
});

it("detectByWaypoint - waypoint too far from track (>50m) → skipped pair", () => {
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
  expect(result.segments.length).toEqual(1);
  expect(result.segments[0].type).toEqual("run");
  expect(result.segments[0].startTrackpointIndex).toEqual(0);
  expect(result.segments[0].endTrackpointIndex).toEqual(2);
});

it("detectByWaypoint - multiple swim pairs in correct order", () => {
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
  expect(result.segments.length).toEqual(5);
  expect(result.segments[0].type).toEqual("run");
  expect(result.segments[1].type).toEqual("swim");
  expect(result.segments[2].type).toEqual("run");
  expect(result.segments[3].type).toEqual("swim");
  expect(result.segments[4].type).toEqual("run");
});

it("detectByWaypoint - validates pairing and excludes unpaired starts", () => {
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
  expect(swimSegments.length).toEqual(1);
});
