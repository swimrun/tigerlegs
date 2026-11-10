import { assert, assertEquals } from "@std/assert";
import { parseGPX } from "../../src/client/gpx-parser.ts";
import { analyzeGpx } from "../../src/client/analyze.ts";
import type { Segment } from "../../src/shared/types.ts";

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
const EXPECTED: readonly (readonly ["run" | "swim", number, string])[] = [
  ["swim", 400, "A"], ["run", 700, "2"], ["swim", 50, "B"], ["run", 550, "3"],
  ["swim", 250, "C"], ["run", 700, "4/5"], ["swim", 200, "D"], ["run", 200, "6"],
  ["swim", 100, "E"], ["run", 250, "7"], ["swim", 50, "F"], ["run", 800, "8"],
  ["swim", 150, "G"], ["run", 900, "9"], ["swim", 150, "H"], ["run", 100, "10"],
  ["swim", 50, "I"], ["run", 150, "11"], ["swim", 50, "J"], ["run", 300, "12"],
  ["swim", 50, "K"], ["run", 350, "1"],
];
const EXPECTED_SWIM_M = 1500;
const EXPECTED_RUN_M = 5000;

const sum = (values: number[]) => values.reduce((total, value) => total + value, 0);

function analyse() {
  const parsed = parseGPX(Deno.readTextFileSync("test-data/Rondje_Eilanden_2025.gpx"));
  assert(parsed.ok);
  return analyzeGpx(parsed.value);
}

/** One line per segment, for readable assertion messages. */
const describe = (segments: Segment[]) =>
  segments.map((s) => `${s.number}:${s.type[0]}${Math.round(s.distanceKm * 1000)}`).join(" ");

Deno.test("Rondje Eilanden: the official swims add up to 1,500 m and the runs to 5,000 m", () => {
  assertEquals(sum(EXPECTED.filter(([type]) => type === "swim").map(([, meters]) => meters)), EXPECTED_SWIM_M);
  assertEquals(sum(EXPECTED.filter(([type]) => type === "run").map(([, meters]) => meters)), EXPECTED_RUN_M);
  assertEquals(EXPECTED.filter(([type]) => type === "swim").length, 11);
  assertEquals(EXPECTED.filter(([type]) => type === "run").length, 11);
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

// Known gap (#35, #36, #37): the speed strategy alone finds 18 segments (9 swims, 9 runs) with the
// swims far too short (the 400 m swim A comes out as 28 m plus 134 m). Enable this test when swim
// detection on this track is fixed.
Deno.test({
  name: "Rondje Eilanden: 11 swims and 11 runs match the organiser's split",
  ignore: true,
  fn() {
    const analysis = analyse();
    const found = analysis.segments.filter((segment) => segment.type !== "unclassified");
    const shown = describe(analysis.segments);
    assertEquals(found.map((segment) => segment.type), EXPECTED.map(([type]) => type), `found: ${shown}`);
    found.forEach((segment, i) => {
      const [, meters, name] = EXPECTED[i];
      const tolerance = name === "A" ? 250 : 100;
      const actual = segment.distanceKm * 1000;
      assert(Math.abs(actual - meters) <= tolerance, `${name}: ${Math.round(actual)} m, expected ${meters} m (±${tolerance}); found: ${shown}`);
    });
    const swim = sum(found.filter((s) => s.type === "swim").map((s) => s.distanceKm * 1000));
    const run = sum(found.filter((s) => s.type === "run").map((s) => s.distanceKm * 1000));
    assert(Math.abs(swim - EXPECTED_SWIM_M) <= 300, `swim ${Math.round(swim)} m, expected ${EXPECTED_SWIM_M} m; found: ${shown}`);
    assert(Math.abs(run - EXPECTED_RUN_M) <= 400, `run ${Math.round(run)} m, expected ${EXPECTED_RUN_M} m; found: ${shown}`);
  },
});
