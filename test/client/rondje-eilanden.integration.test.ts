import { assert, assertEquals } from "@std/assert";
import { parseGPX } from "../../src/client/gpx-parser.ts";
import { analyzeGpx } from "../../src/client/analyze.ts";
import { parseWater } from "../../src/client/water.ts";
import type { StrategyName } from "../../src/shared/types.ts";
import { type ExpectedLeg, mismatch, sum, summarize } from "./oracle.ts";

/**
 * Het Rondje Eilanden (Vinkeveen), recorded on 2025-07-19 with Strava (1 s sampling, no waypoints).
 * The expected split is the organiser's own course map: 11 swims (A to K) and 11 runs, 1,500 m of
 * swimming and 5,000 m of running. The map rounds to 50 m and the recorded first swim was 100 to
 * 200 m longer than the standard one, so that swim gets a wider tolerance.
 * Source: Het Rondje Eilanden (n.d.), https://www.hetrondjeeilanden.nl/wedstrijd/parcours/ (full reference:
 * test-data/README.md).
 *
 * Order along the course: the race starts with swim A, and the last run is island 1.
 */
const OFFICIAL: readonly (readonly ["run" | "swim", number, string])[] = [
  ["swim", 400, "A"], ["run", 700, "2"], ["swim", 50, "B"], ["run", 550, "3"],
  ["swim", 250, "C"], ["run", 700, "4/5"], ["swim", 200, "D"], ["run", 200, "6"],
  ["swim", 100, "E"], ["run", 250, "7"], ["swim", 50, "F"], ["run", 800, "8"],
  ["swim", 150, "G"], ["run", 900, "9"], ["swim", 150, "H"], ["run", 100, "10"],
  ["swim", 50, "I"], ["run", 150, "11"], ["swim", 50, "J"], ["run", 300, "12"],
  ["swim", 50, "K"], ["run", 350, "1"],
];
const EXPECTED: readonly ExpectedLeg[] = OFFICIAL.map(([type, meters, name]) => ({ type, meters, name }));
const EXPECTED_SWIM_M = 1500;
const EXPECTED_RUN_M = 5000;

/**
 * Water around the track from OpenStreetMap (Overpass, snapshot 2026-06-01): natural=water and
 * waterway=riverbank, cut down to the area of the track so the fixture stays small.
 */
const water = parseWater(JSON.parse(Deno.readTextFileSync("test/fixtures/rondje-eilanden-overpass.json")));

/** The three ways the extractor can work on this recording (no waypoints in the file). */
function analyse(strategies: readonly StrategyName[] = ["speed", "landscape"]) {
  const parsed = parseGPX(Deno.readTextFileSync("test-data/Rondje_Eilanden_2025.gpx"));
  assert(parsed.ok);
  return analyzeGpx(parsed.value, water, { enabledStrategies: strategies });
}

Deno.test("Rondje Eilanden: the official swims add up to 1,500 m and the runs to 5,000 m", () => {
  assertEquals(sum(EXPECTED.filter((leg) => leg.type === "swim").map((leg) => leg.meters)), EXPECTED_SWIM_M);
  assertEquals(sum(EXPECTED.filter((leg) => leg.type === "run").map((leg) => leg.meters)), EXPECTED_RUN_M);
  assertEquals(EXPECTED.filter((leg) => leg.type === "swim").length, 11);
  assertEquals(EXPECTED.filter((leg) => leg.type === "run").length, 11);
});

Deno.test("Rondje Eilanden: the segments cover the whole track without gaps", () => {
  const analysis = analyse();
  assertEquals(analysis.segments[0].startTrackpointIndex, 0);
  assertEquals(analysis.segments.at(-1)?.endTrackpointIndex, 4490);
  for (let i = 1; i < analysis.segments.length; i++) {
    assertEquals(analysis.segments[i].startTrackpointIndex, analysis.segments[i - 1].endTrackpointIndex + 1);
  }
});

// The recording is 6,958 m against 6,500 m official: it includes some warming up and cooling down, and
// GPS noise in the water adds distance. A 10% margin documents that gap.
Deno.test("Rondje Eilanden: the segments stay within 10% of the official total distance", () => {
  const total = sum(analyse().segments.map((segment) => segment.distanceKm * 1000));
  const expected = EXPECTED_SWIM_M + EXPECTED_RUN_M;
  assert(Math.abs(total - expected) <= expected * 0.1, `total ${Math.round(total)} m, expected ${expected} m (±10%)`);
});

// One test per way of detecting, each against the same official split. They fail until that way of
// detecting is accurate, so while it is not they are ignored, each pointing to the issue that tracks it.
// Their current output is pinned in the ratchet tests below, so it cannot get worse unnoticed.
const APPROACHES: [string, readonly StrategyName[], string][] = [
  ["speed only", ["speed"], "#35"],
  ["terrain only", ["landscape"], "#36"],
  ["speed and terrain combined", ["speed", "landscape"], "#37"],
];
for (const [name, strategies, issue] of APPROACHES) {
  Deno.test({
    name: `Rondje Eilanden, ${name}: 11 swims and 11 runs match the organiser's split (${issue})`,
    ignore: true,
    fn() {
      assertEquals(mismatch(analyse(strategies).segments, EXPECTED), null);
    },
  });
}

// Ratchets: today's error per approach, in metres off the official total. A change may make a number
// smaller (better) but not larger. When an approach improves, lower its numbers here.
const RATCHET: Record<string, { swimErrorM: number; runErrorM: number }> = {
  "speed only": { swimErrorM: 930, runErrorM: 1390 },
  "terrain only": { swimErrorM: 4710, runErrorM: 5000 },
  "speed and terrain combined": { swimErrorM: 480, runErrorM: 940 },
};
for (const [name, strategies] of APPROACHES) {
  Deno.test(`Rondje Eilanden, ${name}: no worse than the pinned error`, () => {
    const result = summarize(analyse(strategies).segments);
    const swimErrorM = Math.abs(result.swimM - EXPECTED_SWIM_M);
    const runErrorM = Math.abs(result.runM - EXPECTED_RUN_M);
    const pinned = RATCHET[name];
    assert(swimErrorM <= pinned.swimErrorM, `swim off by ${swimErrorM} m, pinned ${pinned.swimErrorM} m; ${result.shown}`);
    assert(runErrorM <= pinned.runErrorM, `run off by ${runErrorM} m, pinned ${pinned.runErrorM} m; ${result.shown}`);
  });
}
