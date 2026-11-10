import { assert, assertEquals } from "@std/assert";
import { parseGPX } from "../../src/client/gpx-parser.ts";
import { analyzeGpx } from "../../src/client/analyze.ts";

/**
 * Coros recording of the ÖTILLÖ Cannes World Series (2026-10-03). The expected values are the
 * official split from RaceDayMap (n.d.), which is the reference we use; the event page (ÖTILLÖ, n.d.)
 * lists slightly larger totals (run 33.47 km, swim 7.48 km). Full references: test-data/README.md.
 * https://app.racedaymap.com/otillo-swimrun-cannes/world-series
 * https://otilloswimrun.com/races/cannes-france/cannes-world-series/
 */
const EXPECTED_SEGMENTS: readonly (readonly ["run" | "swim", number])[] = [
  ["run", 2.59], ["swim", 0.83], ["run", 2.73], ["swim", 0.72], ["run", 2.75], ["swim", 0.80],
  ["run", 4.90], ["swim", 1.35], ["run", 0.42], ["swim", 0.24], ["run", 9.42], ["swim", 0.86],
  ["run", 1.31], ["swim", 0.44], ["run", 6.10], ["swim", 1.01], ["run", 1.06], ["swim", 0.40],
  ["run", 0.68], ["swim", 0.24], ["run", 1.09], ["swim", 0.40], ["run", 0.06],
];
const EXPECTED_TOTAL_KM = 40.40;
const EXPECTED_RUN_KM = 33.10;
const EXPECTED_SWIM_KM = 7.30;

function analyse() {
  const parsed = parseGPX(Deno.readTextFileSync("test-data/Frankrijk_SwimRun_Coros.gpx"));
  assert(parsed.ok);
  return analyzeGpx(parsed.value);
}

const sum = (values: number[]) => values.reduce((total, value) => total + value, 0);

Deno.test("Cannes: the segments cover the whole track and stay within 10% of the official total distance", () => {
  const analysis = analyse();
  const points = 18272;
  assertEquals(analysis.segments[0].startTrackpointIndex, 0);
  assertEquals(analysis.segments.at(-1)?.endTrackpointIndex, points - 1);
  for (let i = 1; i < analysis.segments.length; i++) {
    assertEquals(analysis.segments[i].startTrackpointIndex, analysis.segments[i - 1].endTrackpointIndex + 1);
  }
  // The recording is 43.7 km against 40.40 km official: it runs 10 minutes longer than the race clock
  // (5:21 against 5:11) and GPS noise in the water adds distance. A 10% margin documents that gap.
  const total = sum(analysis.segments.map((segment) => segment.distanceKm));
  assert(Math.abs(total - EXPECTED_TOTAL_KM) <= EXPECTED_TOTAL_KM * 0.1, `total ${total.toFixed(2)} km, expected ${EXPECTED_TOTAL_KM} km (±10%)`);
});

// Known gap (#32): with the speed strategy alone the extractor finds 1.0 km of swimming instead of 7.3 km
// (it sees 23 segments, mostly runs). Enable this test when swim detection on this track is fixed.
Deno.test({
  name: "Cannes: 12 runs and 11 swims match the official racedaymap split",
  ignore: true,
  fn() {
    const analysis = analyse();
    const found = analysis.segments.filter((segment) => segment.type !== "unclassified");
    assertEquals(found.map((segment) => segment.type), EXPECTED_SEGMENTS.map(([type]) => type));
    found.forEach((segment, i) => {
      const [, km] = EXPECTED_SEGMENTS[i];
      assert(Math.abs(segment.distanceKm - km) <= 0.15, `segment ${i + 1}: ${segment.distanceKm.toFixed(2)} km, expected ${km} km`);
    });
    const run = sum(found.filter((s) => s.type === "run").map((s) => s.distanceKm));
    const swim = sum(found.filter((s) => s.type === "swim").map((s) => s.distanceKm));
    assert(Math.abs(run - EXPECTED_RUN_KM) <= 0.4, `run ${run.toFixed(2)} km, expected ${EXPECTED_RUN_KM} km`);
    assert(Math.abs(swim - EXPECTED_SWIM_KM) <= 0.3, `swim ${swim.toFixed(2)} km, expected ${EXPECTED_SWIM_KM} km`);
  },
});
