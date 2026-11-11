import { expect, it } from "vitest";
import {
  detectApplicableStrategies,
  combineStrategies,
  detectConflicts,
} from "./strategy-combiner.ts";
import type {
  GPXData,
  StrategyResult,
  Trackpoint,
  Segment
} from "../shared/types.ts";

// --- Test helpers ---

function makeTrackpoint(
  index: number,
  lat = 45.0 + index * 0.001,
  lon = 6.0 + index * 0.001,
  timestamp: string | null = null,
): Trackpoint {
  return {
    coordinate: { lat, lon },
    elevation: 100,
    timestamp,
    index,
  };
}

function makeTrackpoints(count: number, withTimestamps = false): Trackpoint[] {
  return Array.from({ length: count }, (_, i) =>
    makeTrackpoint(
      i,
      45.0 + i * 0.001,
      6.0 + i * 0.001,
      withTimestamps ? new Date(Date.now() + i * 10000).toISOString() : null,
    )
  );
}

// --- detectApplicableStrategies tests ---

it("detectApplicableStrategies - landscape always applicable with trackpoints", () => {
  const gpxData: GPXData = {
    waypoints: [],
    tracks: [{ name: "Track", trackpoints: makeTrackpoints(5) }],
  };
  const strategies = detectApplicableStrategies(gpxData);
  expect(strategies).toEqual(expect.arrayContaining(["landscape"]));
});

it("detectApplicableStrategies - speed applicable with consecutive timestamps", () => {
  const gpxData: GPXData = {
    waypoints: [],
    tracks: [{ name: "Track", trackpoints: makeTrackpoints(5, true) }],
  };
  const strategies = detectApplicableStrategies(gpxData);
  expect(strategies).toEqual(expect.arrayContaining(["speed"]));
  expect(strategies).toEqual(expect.arrayContaining(["landscape"]));
});

it("detectApplicableStrategies - speed not applicable without timestamps", () => {
  const gpxData: GPXData = {
    waypoints: [],
    tracks: [{ name: "Track", trackpoints: makeTrackpoints(5, false) }],
  };
  const strategies = detectApplicableStrategies(gpxData);
  expect(strategies.includes("speed")).toEqual(false);
});

it("detectApplicableStrategies - waypoint applicable with sym 200", () => {
  const gpxData: GPXData = {
    waypoints: [
      {
        coordinate: { lat: 45.0, lon: 6.0 },
        elevation: 100,
        name: "Start",
        symbol: "200",
        description: "",
      },
    ],
    tracks: [{ name: "Track", trackpoints: makeTrackpoints(5) }],
  };
  const strategies = detectApplicableStrategies(gpxData);
  expect(strategies).toEqual(expect.arrayContaining(["waypoint"]));
});

it("detectApplicableStrategies - waypoint applicable with sym 201", () => {
  const gpxData: GPXData = {
    waypoints: [
      {
        coordinate: { lat: 45.0, lon: 6.0 },
        elevation: 100,
        name: "End",
        symbol: "201",
        description: "",
      },
    ],
    tracks: [{ name: "Track", trackpoints: makeTrackpoints(5) }],
  };
  const strategies = detectApplicableStrategies(gpxData);
  expect(strategies).toEqual(expect.arrayContaining(["waypoint"]));
});

it("detectApplicableStrategies - waypoint applicable with name 'Début SWIM...'", () => {
  const gpxData: GPXData = {
    waypoints: [
      {
        coordinate: { lat: 45.0, lon: 6.0 },
        elevation: 100,
        name: "Début SWIM 1",
        symbol: "",
        description: "",
      },
    ],
    tracks: [{ name: "Track", trackpoints: makeTrackpoints(5) }],
  };
  const strategies = detectApplicableStrategies(gpxData);
  expect(strategies).toEqual(expect.arrayContaining(["waypoint"]));
});

it("detectApplicableStrategies - waypoint not applicable with unrelated waypoints", () => {
  const gpxData: GPXData = {
    waypoints: [
      {
        coordinate: { lat: 45.0, lon: 6.0 },
        elevation: 100,
        name: "Random Point",
        symbol: "0",
        description: "",
      },
    ],
    tracks: [{ name: "Track", trackpoints: makeTrackpoints(5) }],
  };
  const strategies = detectApplicableStrategies(gpxData);
  expect(strategies.includes("waypoint")).toEqual(false);
});

it("detectApplicableStrategies - empty tracks returns empty array", () => {
  const gpxData: GPXData = {
    waypoints: [],
    tracks: [],
  };
  const strategies = detectApplicableStrategies(gpxData);
  expect(strategies).toEqual([]);
});

// --- combineStrategies tests ---

it("combineStrategies - single strategy becomes segments directly", () => {
  const results: StrategyResult[] = [
    {
      strategy: "waypoint",
      segments: [
        { type: "run", startTrackpointIndex: 0, endTrackpointIndex: 4, confidenceScore: 0.95 },
        { type: "swim", startTrackpointIndex: 5, endTrackpointIndex: 9, confidenceScore: 0.95 },
      ],
    },
  ];
  const segments = combineStrategies(results, 10);
  expect(segments.length).toEqual(2);
  expect(segments[0].type).toEqual("run");
  expect(segments[0].startTrackpointIndex).toEqual(0);
  expect(segments[0].endTrackpointIndex).toEqual(4);
  expect(segments[0].number).toEqual(1);
  expect(segments[1].type).toEqual("swim");
  expect(segments[1].startTrackpointIndex).toEqual(5);
  expect(segments[1].endTrackpointIndex).toEqual(9);
  expect(segments[1].number).toEqual(2);
});

it("combineStrategies - higher confidence wins per trackpoint", () => {
  const results: StrategyResult[] = [
    {
      strategy: "speed",
      segments: [
        { type: "run", startTrackpointIndex: 0, endTrackpointIndex: 9, confidenceScore: 0.5 },
      ],
    },
    {
      strategy: "landscape",
      segments: [
        { type: "run", startTrackpointIndex: 0, endTrackpointIndex: 4, confidenceScore: 0.7 },
        { type: "swim", startTrackpointIndex: 5, endTrackpointIndex: 9, confidenceScore: 0.8 },
      ],
    },
  ];
  const segments = combineStrategies(results, 10);
  expect(segments.length).toEqual(2);
  expect(segments[0].type).toEqual("run");
  expect(segments[0].endTrackpointIndex).toEqual(4);
  expect(segments[1].type).toEqual("swim");
  expect(segments[1].startTrackpointIndex).toEqual(5);
});

it("combineStrategies - unclassified when all confidence < 0.3", () => {
  const results: StrategyResult[] = [
    {
      strategy: "speed",
      segments: [
        { type: "run", startTrackpointIndex: 0, endTrackpointIndex: 9, confidenceScore: 0.2 },
      ],
    },
    {
      strategy: "landscape",
      segments: [
        { type: "swim", startTrackpointIndex: 0, endTrackpointIndex: 9, confidenceScore: 0.1 },
      ],
    },
  ];
  const segments = combineStrategies(results, 10);
  expect(segments.length).toEqual(1);
  expect(segments[0].type).toEqual("unclassified");
});

it("combineStrategies - ensures complete contiguous coverage", () => {
  const results: StrategyResult[] = [
    {
      strategy: "waypoint",
      segments: [
        // Gap at indices 5-6, no strategy covers them
        { type: "swim", startTrackpointIndex: 0, endTrackpointIndex: 4, confidenceScore: 0.9 },
        { type: "run", startTrackpointIndex: 7, endTrackpointIndex: 9, confidenceScore: 0.9 },
      ],
    },
  ];
  const segments = combineStrategies(results, 10);
  // Should cover all trackpoints 0-9 contiguously
  expect(segments[0].startTrackpointIndex).toEqual(0);
  const lastSegment = segments[segments.length - 1];
  expect(lastSegment.endTrackpointIndex).toEqual(9);
  // Check contiguity
  for (let i = 1; i < segments.length; i++) {
    expect(segments[i].startTrackpointIndex).toEqual(segments[i - 1].endTrackpointIndex + 1);
  }
});

it("combineStrategies - sequential numbering", () => {
  const results: StrategyResult[] = [
    {
      strategy: "speed",
      segments: [
        { type: "run", startTrackpointIndex: 0, endTrackpointIndex: 3, confidenceScore: 0.8 },
        { type: "swim", startTrackpointIndex: 4, endTrackpointIndex: 6, confidenceScore: 0.8 },
        { type: "run", startTrackpointIndex: 7, endTrackpointIndex: 9, confidenceScore: 0.8 },
      ],
    },
  ];
  const segments = combineStrategies(results, 10);
  for (let i = 0; i < segments.length; i++) {
    expect(segments[i].number).toEqual(i + 1);
  }
});

it("combineStrategies - detectedBy tracks which strategies contributed", () => {
  const results: StrategyResult[] = [
    {
      strategy: "waypoint",
      segments: [
        { type: "swim", startTrackpointIndex: 0, endTrackpointIndex: 9, confidenceScore: 0.95 },
      ],
    },
    {
      strategy: "landscape",
      segments: [
        { type: "swim", startTrackpointIndex: 0, endTrackpointIndex: 9, confidenceScore: 0.7 },
      ],
    },
  ];
  const segments = combineStrategies(results, 10);
  expect(segments.length).toEqual(1);
  expect(segments[0].detectedBy).toEqual(expect.arrayContaining(["waypoint"]));
});

it("combineStrategies - empty results with trackpoints creates unclassified segment", () => {
  const results: StrategyResult[] = [];
  const segments = combineStrategies(results, 10);
  expect(segments.length).toEqual(1);
  expect(segments[0].type).toEqual("unclassified");
  expect(segments[0].startTrackpointIndex).toEqual(0);
  expect(segments[0].endTrackpointIndex).toEqual(9);
});

it("combineStrategies - zero trackpoints returns empty", () => {
  const results: StrategyResult[] = [];
  const segments = combineStrategies(results, 0);
  expect(segments.length).toEqual(0);
});

// --- detectConflicts tests ---

it("detectConflicts - no conflicts when strategies agree", () => {
  const trackpoints = makeTrackpoints(10);
  const results: StrategyResult[] = [
    {
      strategy: "waypoint",
      segments: [
        { type: "run", startTrackpointIndex: 0, endTrackpointIndex: 4, confidenceScore: 0.95 },
        { type: "swim", startTrackpointIndex: 5, endTrackpointIndex: 9, confidenceScore: 0.95 },
      ],
    },
    {
      strategy: "speed",
      segments: [
        { type: "run", startTrackpointIndex: 0, endTrackpointIndex: 4, confidenceScore: 0.7 },
        { type: "swim", startTrackpointIndex: 5, endTrackpointIndex: 9, confidenceScore: 0.7 },
      ],
    },
  ];
  const conflicts = detectConflicts(results, trackpoints);
  expect(conflicts.length).toEqual(0);
});

it("detectConflicts - detects conflict when boundaries are within 100m", () => {
  // Create trackpoints very close together (within 100m)
  const trackpoints: Trackpoint[] = Array.from({ length: 10 }, (_, i) => ({
    coordinate: { lat: 45.0, lon: 6.0 + i * 0.0001 }, // ~11m apart
    elevation: 100,
    timestamp: null,
    index: i,
  }));

  const results: StrategyResult[] = [
    {
      strategy: "waypoint",
      segments: [
        { type: "run", startTrackpointIndex: 0, endTrackpointIndex: 4, confidenceScore: 0.95 },
        { type: "swim", startTrackpointIndex: 5, endTrackpointIndex: 9, confidenceScore: 0.95 },
      ],
    },
    {
      strategy: "speed",
      segments: [
        { type: "run", startTrackpointIndex: 0, endTrackpointIndex: 6, confidenceScore: 0.7 },
        { type: "swim", startTrackpointIndex: 7, endTrackpointIndex: 9, confidenceScore: 0.7 },
      ],
    },
  ];
  const conflicts = detectConflicts(results, trackpoints);
  // Boundary at 4→5 vs 6→7 for run→swim transition, within 100m
  expect(conflicts.length > 0).toEqual(true);
  expect(conflicts[0].strategies.length).toEqual(2);
  expect(conflicts[0].resolvedBy).toEqual("waypoint"); // Higher confidence
});

it("detectConflicts - no conflict when boundaries are far apart", () => {
  // Create trackpoints far apart (>100m between each)
  const trackpoints: Trackpoint[] = Array.from({ length: 10 }, (_, i) => ({
    coordinate: { lat: 45.0 + i * 0.01, lon: 6.0 }, // ~1.1km apart
    elevation: 100,
    timestamp: null,
    index: i,
  }));

  const results: StrategyResult[] = [
    {
      strategy: "waypoint",
      segments: [
        { type: "run", startTrackpointIndex: 0, endTrackpointIndex: 2, confidenceScore: 0.95 },
        { type: "swim", startTrackpointIndex: 3, endTrackpointIndex: 9, confidenceScore: 0.95 },
      ],
    },
    {
      strategy: "speed",
      segments: [
        { type: "run", startTrackpointIndex: 0, endTrackpointIndex: 6, confidenceScore: 0.7 },
        { type: "swim", startTrackpointIndex: 7, endTrackpointIndex: 9, confidenceScore: 0.7 },
      ],
    },
  ];
  const conflicts = detectConflicts(results, trackpoints);
  expect(conflicts.length).toEqual(0);
});

it("detectConflicts - single strategy produces no conflicts", () => {
  const trackpoints = makeTrackpoints(10);
  const results: StrategyResult[] = [
    {
      strategy: "waypoint",
      segments: [
        { type: "run", startTrackpointIndex: 0, endTrackpointIndex: 4, confidenceScore: 0.95 },
        { type: "swim", startTrackpointIndex: 5, endTrackpointIndex: 9, confidenceScore: 0.95 },
      ],
    },
  ];
  const conflicts = detectConflicts(results, trackpoints);
  expect(conflicts.length).toEqual(0);
});
