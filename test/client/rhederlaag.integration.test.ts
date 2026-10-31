import { assert, assertEquals } from "@std/assert";
import { parseGPX } from "../../src/client/gpx-parser.ts";
import { analyzeGpx } from "../../src/client/analyze.ts";
import { formatSegmentDistance } from "../../src/client/segment-builder.ts";

// Strava recording, 1 s sampling, no waypoints: only the speed strategy applies.
const FILE = new URL("../../public/samples/rhederlaag-swimrun.gpx", import.meta.url);

function analyse() {
  const parsed = parseGPX(Deno.readTextFileSync(FILE));
  assert(parsed.ok);
  return analyzeGpx(parsed.value);
}

Deno.test("Rhederlaag: uses the speed strategy only", () => {
  assertEquals(analyse().strategies, ["speed"]);
});

Deno.test("Rhederlaag: no swim or run segment rounds to zero", () => {
  for (const seg of analyse().segments) {
    const d = formatSegmentDistance(seg);
    if (seg.type === "swim") assert(Number(d.swimDistanceM) >= 50, `segment ${seg.number}`);
    if (seg.type === "run") assert(Number(d.runDistanceKm) >= 0.1, `segment ${seg.number}`);
  }
});

Deno.test("Rhederlaag: no two consecutive swims or runs, no consecutive breaks", () => {
  const segs = analyse().segments;
  for (let i = 1; i < segs.length; i++) {
    assert(segs[i].type !== segs[i - 1].type, `segments ${i} and ${i + 1} share a type`);
  }
});

Deno.test("Rhederlaag: segments cover the whole track without gaps", () => {
  const segs = analyse().segments;
  assertEquals(segs[0].startTrackpointIndex, 0);
  for (let i = 1; i < segs.length; i++) {
    assertEquals(segs[i].startTrackpointIndex, segs[i - 1].endTrackpointIndex + 1);
  }
});

// Regression snapshot of the current algorithm. The real course has about 12 swims
// and 12 runs (to be confirmed); tighten these numbers when the algorithm gets there.
Deno.test("Rhederlaag: swim and run counts and totals (current baseline)", () => {
  const a = analyse();
  const count = (t: string) => a.segments.filter((s) => s.type === t).length;
  assertEquals(count("swim"), 8);
  assertEquals(count("run"), 8);
  assertEquals(a.totals.totalRunKm, "9.0");
  assertEquals(a.totals.totalSwimM, "1050");
});
