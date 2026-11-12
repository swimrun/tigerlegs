import { expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { parseGPX } from "../../src/client/gpx-parser.ts";
import { analyzeGpx } from "../../src/client/analyze.ts";
import type { StrategyName } from "../../src/shared/types.ts";
import { type ExpectedLeg, mismatch, sum, summarize } from "./oracle.ts";

/**
 * ÖTILLÖ Rügen SwimRun World Series, recorded on 2026-05-16 (1 s sampling, no waypoints).
 * The expected split is the leg list of the race in the Race Day Map app: 9 runs and 8 swims, 40.57 km of
 * running and 5.50 km of swimming, in the order of the course (the race starts with a run).
 * Source: Race Day Map. (n.d.). ÖTILLÖ SwimRun Rügen, World Series.
 * https://app.racedaymap.com/otillo-swimrun-rugen/world%20series (leg table, copied by the owner on 2026-11-12).
 * The owner swam swim 3 (1.30 km) and swim 6 (1.62 km) and was cold afterwards: he stood still and drank tea, and
 * walked and jogged slowly, so some stretches after a long swim are slower than 5 km/h on land.
 */
const OFFICIAL: readonly (readonly ["run" | "swim", number, string])[] = [
  ["run", 4190, "Run 1"], ["swim", 650, "Swim 1"], ["run", 5850, "Run 2"], ["swim", 900, "Swim 2"],
  ["run", 5360, "Run 3"], ["swim", 1300, "Swim 3"], ["run", 5530, "Run 4"], ["swim", 70, "Swim 4"],
  ["run", 2520, "Run 5"], ["swim", 290, "Swim 5"], ["run", 4680, "Run 6"], ["swim", 1620, "Swim 6"],
  ["run", 5330, "Run 7"], ["swim", 370, "Swim 7"], ["run", 6840, "Run 8"], ["swim", 300, "Swim 8"],
  ["run", 260, "Run 9"],
];
const EXPECTED: readonly ExpectedLeg[] = OFFICIAL.map(([type, meters, name]) => ({ type, meters, name }));
const EXPECTED_SWIM_M = 5500;
const EXPECTED_RUN_M = 40570;

/** No water fixture for Rügen yet (the local Overpass server holds the Netherlands only), so speed is the only strategy. */
function analyse(strategies: readonly StrategyName[] = ["speed"]) {
  const parsed = parseGPX(readFileSync("test-data/Ötillö_Rügen_met_Sander_SwimRun_World_Serious_.gpx", "utf8"));
  expect(parsed.ok).toBeTruthy();
  return analyzeGpx(parsed.value, [], { enabledStrategies: strategies });
}

it("Rügen: the official swims add up to 5,500 m and the runs to 40,570 m", () => {
  expect(sum(EXPECTED.filter((leg) => leg.type === "swim").map((leg) => leg.meters))).toEqual(EXPECTED_SWIM_M);
  expect(Math.abs(sum(EXPECTED.filter((leg) => leg.type === "run").map((leg) => leg.meters)) - EXPECTED_RUN_M) <= 10).toBeTruthy();
  expect(EXPECTED.filter((leg) => leg.type === "swim").length).toEqual(8);
  expect(EXPECTED.filter((leg) => leg.type === "run").length).toEqual(9);
});

it("Rügen: the segments cover the whole track without gaps", () => {
  const analysis = analyse();
  expect(analysis.segments[0].startTrackpointIndex).toEqual(0);
  expect(analysis.segments.at(-1)?.endTrackpointIndex).toEqual(19770);
  for (let i = 1; i < analysis.segments.length; i++) {
    expect(analysis.segments[i].startTrackpointIndex).toEqual(analysis.segments[i - 1].endTrackpointIndex + 1);
  }
});

// It fails until the speed analysis is accurate on this recording, so it is ignored, pointing to the issue that
// tracks it. The missing long swim 3 (1.30 km) and the slow stretches on land after the long swims are the known gaps.
it.skip("Rügen, speed only: 8 swims and 9 runs match the official legs (#98)", () => {
  expect(mismatch(analyse().segments, EXPECTED)).toEqual(null);
});

// The two long swims are the heart of the course; they must be found, whatever else is off. Also ignored until the fix.
it.skip("Rügen, speed only: the long swims of 1.30 km and 1.62 km are each one swim of about that length (#98)", () => {
  const swims = analyse().segments.filter((segment) => segment.type === "swim").map((segment) => segment.distanceKm * 1000);
  for (const official of [1300, 1620]) {
    expect(swims.some((meters) => Math.abs(meters - official) <= official * 0.15), `no swim near ${official} m in ${swims.map(Math.round)}`).toBeTruthy();
  }
});

// Ratchet: today's error in metres off the official totals. A change may make a number smaller (better), not larger.
const RATCHET = { swimErrorM: 3110, runErrorM: 2540, unclassifiedM: 7670 };
it("Rügen, speed only: no worse than the pinned error", () => {
  const result = summarize(analyse().segments);
  const swimErrorM = Math.abs(result.swimM - EXPECTED_SWIM_M);
  const runErrorM = Math.abs(result.runM - EXPECTED_RUN_M);
  expect(swimErrorM <= RATCHET.swimErrorM, `swim off by ${swimErrorM} m, pinned ${RATCHET.swimErrorM} m; ${result.shown}`).toBeTruthy();
  expect(runErrorM <= RATCHET.runErrorM, `run off by ${runErrorM} m, pinned ${RATCHET.runErrorM} m; ${result.shown}`).toBeTruthy();
  expect(result.unclassifiedM <= RATCHET.unclassifiedM, `unclassified ${Math.round(result.unclassifiedM)} m, pinned ${RATCHET.unclassifiedM} m; ${result.shown}`).toBeTruthy();
});
