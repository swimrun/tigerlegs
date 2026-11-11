/**
 * Property-based tests for the strategy combiner (Properties 20 & 21).
 *
 * **Validates: Requirements 16.1, 16.2, 16.3, 16.5, 16.9**
 */
import fc from "fast-check";
import { expect, it } from "vitest";
import {
  combineStrategies,
  detectApplicableStrategies,
} from "../../src/client/strategy-combiner.ts";
import type {
  GPXData,
  SegmentType,
  StrategyName,
  StrategyResult,
  StrategySegment,
  Trackpoint,
  Waypoint,
} from "../../src/shared/types.ts";

type Claim = "swim" | "run" | null;

const claims = fc.constantFrom<Claim>("swim", "run", null);

// Confidence ranges do not overlap, so the winner at a trackpoint is never a tie.
const confidenceRanges: Record<StrategyName, [number, number]> = {
  waypoint: [0.05, 0.5],
  speed: [0.51, 0.7],
  landscape: [0.71, 1],
};
const strategyNames: StrategyName[] = ["waypoint", "speed", "landscape"];

interface Scenario {
  trackpointCount: number;
  perStrategy: { name: StrategyName; confidence: number; claims: Claim[] }[];
}

const scenarios: fc.Arbitrary<Scenario> = fc.integer({ min: 1, max: 40 })
  .chain((trackpointCount) =>
    fc.tuple(
      ...strategyNames.map((name) =>
        fc.record({
          name: fc.constant(name),
          confidence: fc.double({
            min: confidenceRanges[name][0],
            max: confidenceRanges[name][1],
            noNaN: true,
          }),
          claims: fc.array(claims, {
            minLength: trackpointCount,
            maxLength: trackpointCount,
          }),
        })
      ),
    ).map((perStrategy) => ({ trackpointCount, perStrategy }))
  );

function toResult(s: Scenario["perStrategy"][number]): StrategyResult {
  const segments: StrategySegment[] = [];
  let start = 0;
  for (let i = 1; i <= s.claims.length; i++) {
    if (i === s.claims.length || s.claims[i] !== s.claims[start]) {
      const claim = s.claims[start];
      if (claim !== null) {
        segments.push({
          type: claim,
          startTrackpointIndex: start,
          endTrackpointIndex: i - 1,
          confidenceScore: s.confidence,
        });
      }
      start = i;
    }
  }
  return { strategy: s.name, segments };
}

// --- Property 20: Strategy combination resolves by highest confidence ---

it("Property 20.1: combined segments cover every trackpoint contiguously and are numbered sequentially", () => {
  fc.assert(fc.property(scenarios, (scenario) => {
      const results = scenario.perStrategy.map(toResult);
      const segments = combineStrategies(results, scenario.trackpointCount);

      expect(segments[0].startTrackpointIndex).toEqual(0);
      expect(segments[segments.length - 1].endTrackpointIndex).toEqual(scenario.trackpointCount - 1);
      segments.forEach((segment, i) => {
        expect(segment.number).toEqual(i + 1);
        if (i > 0) {
          expect(segment.startTrackpointIndex).toEqual(segments[i - 1].endTrackpointIndex + 1);
        }
      });
    }), { numRuns: 200 });
});

it("Property 20.2: each trackpoint takes the type of the highest-confidence strategy, or unclassified below 0.3", () => {
  fc.assert(fc.property(scenarios, (scenario) => {
      const results = scenario.perStrategy.map(toResult);
      const segments = combineStrategies(results, scenario.trackpointCount);

      for (let i = 0; i < scenario.trackpointCount; i++) {
        let expected: SegmentType = "unclassified";
        let best = 0;
        for (const s of scenario.perStrategy) {
          const claim = s.claims[i];
          if (claim !== null && s.confidence > best) {
            best = s.confidence;
            expected = claim;
          }
        }
        if (best < 0.3) expected = "unclassified";

        const segment = segments.find((seg) =>
          i >= seg.startTrackpointIndex && i <= seg.endTrackpointIndex
        );
        expect(segment !== undefined).toBeTruthy();
        expect(segment.type).toEqual(expected);
      }
    }), { numRuns: 200 });
});

it("Property 20.3: adjacent combined segments never share a type", () => {
  fc.assert(fc.property(scenarios, (scenario) => {
      const results = scenario.perStrategy.map(toResult);
      const segments = combineStrategies(results, scenario.trackpointCount);
      for (let i = 1; i < segments.length; i++) {
        expect(segments[i].type !== segments[i - 1].type).toBeTruthy();
      }
    }), { numRuns: 200 });
});

// --- Property 21: Strategy applicability auto-detection ---

const timestamps = fc.option(
  fc.date({ min: new Date("2000-01-01"), max: new Date("2030-12-31") }).map((
    d,
  ) => d.toISOString()),
  { nil: null },
);

const trackpointsArb: fc.Arbitrary<Trackpoint[]> = fc.array(timestamps, {
  maxLength: 12,
}).map((ts) =>
  ts.map((timestamp, index) => ({
    coordinate: { lat: 45 + index * 0.001, lon: 6 },
    elevation: 100,
    timestamp,
    index,
  }))
);

const waypointsArb: fc.Arbitrary<Waypoint[]> = fc.array(
  fc.record({
    symbol: fc.constantFrom("200", "201", "100", ""),
    name: fc.constantFrom(
      "Début SWIM 1",
      "Fin SWIM 1",
      "Ravito",
      "Start",
    ),
  }),
  { maxLength: 5 },
).map((items) =>
  items.map((item) => ({
    coordinate: { lat: 45, lon: 6 },
    elevation: 0,
    description: "",
    ...item,
  }))
);

it("Property 21.1: applicable strategies match the data that is present", () => {
  fc.assert(fc.property(trackpointsArb, waypointsArb, (trackpoints, waypoints) => {
      const gpx: GPXData = {
        waypoints,
        tracks: [{ name: "t", trackpoints }],
      };
      const applicable = detectApplicableStrategies(gpx);

      expect(applicable.includes("landscape")).toEqual(trackpoints.length > 0);

      const hasConsecutiveTimestamps = trackpoints.some((tp, i) =>
        i > 0 && tp.timestamp !== null &&
        trackpoints[i - 1].timestamp !== null
      );
      expect(applicable.includes("speed")).toEqual(hasConsecutiveTimestamps);

      const hasSwimWaypoint = waypoints.some((wp) =>
        wp.symbol === "200" || wp.symbol === "201" ||
        wp.name.startsWith("Début SWIM") || wp.name.startsWith("Fin SWIM")
      );
      expect(applicable.includes("waypoint")).toEqual(trackpoints.length > 0 && hasSwimWaypoint);
    }), { numRuns: 200 });
});
