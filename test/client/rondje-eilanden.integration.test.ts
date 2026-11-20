import { expect, it } from "vitest";
import { readFileSync } from "node:fs";
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
const water = parseWater(JSON.parse(readFileSync("test/fixtures/rondje-eilanden-overpass.json", "utf8")));

/** The three ways the extractor can work on this recording (no waypoints in the file). */
function analyse(strategies: readonly StrategyName[] = ["speed", "landscape"]) {
  const parsed = parseGPX(readFileSync("test-data/Rondje_Eilanden_2025.gpx", "utf8"));
  expect(parsed.ok).toBeTruthy();
  return analyzeGpx(parsed.value, water, { enabledStrategies: strategies });
}

it("Rondje Eilanden: the official swims add up to 1,500 m and the runs to 5,000 m", () => {
  expect(sum(EXPECTED.filter((leg) => leg.type === "swim").map((leg) => leg.meters))).toEqual(EXPECTED_SWIM_M);
  expect(sum(EXPECTED.filter((leg) => leg.type === "run").map((leg) => leg.meters))).toEqual(EXPECTED_RUN_M);
  expect(EXPECTED.filter((leg) => leg.type === "swim").length).toEqual(11);
  expect(EXPECTED.filter((leg) => leg.type === "run").length).toEqual(11);
});

it("Rondje Eilanden: the segments cover the whole track without gaps", () => {
  const analysis = analyse();
  expect(analysis.segments[0].startTrackpointIndex).toEqual(0);
  expect(analysis.segments.at(-1)?.endTrackpointIndex).toEqual(4490);
  for (let i = 1; i < analysis.segments.length; i++) {
    expect(analysis.segments[i].startTrackpointIndex).toEqual(analysis.segments[i - 1].endTrackpointIndex + 1);
  }
});

// The recording is 6,958 m against 6,500 m official: it includes some warming up and cooling down, and
// GPS noise in the water adds distance. A 10% margin documents that gap.
it("Rondje Eilanden: the segments stay within 10% of the official total distance", () => {
  const total = sum(analyse().segments.map((segment) => segment.distanceKm * 1000));
  const expected = EXPECTED_SWIM_M + EXPECTED_RUN_M;
  expect(Math.abs(total - expected) <= expected * 0.1, `total ${Math.round(total)} m, expected ${expected} m (±10%)`).toBeTruthy();
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
  it.skip(`Rondje Eilanden, ${name}: 11 swims and 11 runs match the organiser's split (${issue})`, () => {
      expect(mismatch(analyse(strategies).segments, EXPECTED)).toEqual(null);
    });
}

// Ratchets: today's error per approach, in metres off the official total. A change may make a number
// smaller (better) but not larger. When an approach improves, lower its numbers here.
// Since issue #98 swim distance is measured over smoothed positions, so jitter no longer pads the swims: the swim
// error grew from 100 to 480 m for the combined approach, because the padding had hidden swim that is still not
// found (swim A is split by the GPS jump at the start). The same change brought Rügen from 3,104 m off to 192 m.
const RATCHET: Record<string, { swimErrorM: number; runErrorM: number }> = {
  "speed only": { swimErrorM: 600, runErrorM: 690 },
  "terrain only": { swimErrorM: 4710, runErrorM: 5000 },
  "speed and terrain combined": { swimErrorM: 480, runErrorM: 560 },
};
for (const [name, strategies] of APPROACHES) {
  it(`Rondje Eilanden, ${name}: no worse than the pinned error`, () => {
    const result = summarize(analyse(strategies).segments);
    const swimErrorM = Math.abs(result.swimM - EXPECTED_SWIM_M);
    const runErrorM = Math.abs(result.runM - EXPECTED_RUN_M);
    const pinned = RATCHET[name];
    expect(swimErrorM <= pinned.swimErrorM, `swim off by ${swimErrorM} m, pinned ${pinned.swimErrorM} m; ${result.shown}`).toBeTruthy();
    expect(runErrorM <= pinned.runErrorM, `run off by ${runErrorM} m, pinned ${pinned.runErrorM} m; ${result.shown}`).toBeTruthy();
  });
}

// Issue #98: swim A at the start was found as a swim, a "run" of 542 m across the water and a second swim,
// because the speed was the mean of one-second steps, which noisy fixes in the water push above 5 km/h.
// The speed is now the net displacement over 10 s, so the water stretch around trackpoints 750-880 is a swim.
it("Rondje Eilanden: the noisy water stretch of swim A is no longer a run, and a swim with terrain (#98)", () => {
  const typeAt = (strategies: readonly StrategyName[]) =>
    analyse(strategies).segments.find((s) => s.startTrackpointIndex <= 800 && s.endTrackpointIndex >= 800)?.type;
  // Speed alone is unsure here (a break of 166 m); it is no longer a run of 542 m.
  expect(typeAt(["speed"]) !== "run", `speed alone: ${typeAt(["speed"])}`).toBeTruthy();
  expect(typeAt(["speed", "landscape"])).toEqual("swim");
});

// The recording of 2026-07-19 is missing the part from island 3 to 5, and there is no official split of it, so
// it is pinned as a snapshot: the number of swims and runs and the distances found with speed and terrain.
it("Rondje Eilanden, lintjes opruimen: snapshot of speed and terrain combined (no official split)", () => {
  const parsed = parseGPX(readFileSync("test-data/Rondje_Eilanden_lintjes_opruimen.gpx", "utf8"));
  expect(parsed.ok).toBeTruthy();
  const result = summarize(analyzeGpx(parsed.value, water, { enabledStrategies: ["speed", "landscape"] }).segments);
  expect([result.swims, result.runs], result.shown).toEqual([9, 10]);
  expect(Math.round(result.swimM / 50) * 50, result.shown).toEqual(1900);
  expect(Math.round(result.runM / 50) * 50, result.shown).toEqual(4050);
});
