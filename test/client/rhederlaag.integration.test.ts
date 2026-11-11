import { expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { parseGPX } from "../../src/client/gpx-parser.ts";
import { analyzeGpx } from "../../src/client/analyze.ts";
import { formatSegmentDistance } from "../../src/client/segment-builder.ts";

// Strava recording, 1 s sampling, no waypoints: only the speed strategy applies.
const FILE = new URL("../../test-data/rhederlaag-swimrun.gpx", import.meta.url);

function analyse() {
  const parsed = parseGPX(readFileSync(FILE, "utf8"));
  expect(parsed.ok).toBeTruthy();
  return analyzeGpx(parsed.value);
}

it("Rhederlaag: uses the speed strategy only", () => {
  expect(analyse().strategies).toEqual(["speed"]);
});

it("Rhederlaag: no swim or run segment rounds to zero", () => {
  for (const seg of analyse().segments) {
    const d = formatSegmentDistance(seg);
    if (seg.type === "swim") expect(Number(d.swimDistanceM) >= 50, `segment ${seg.number}`).toBeTruthy();
    if (seg.type === "run") expect(Number(d.runDistanceKm) >= 0.1, `segment ${seg.number}`).toBeTruthy();
  }
});

it("Rhederlaag: no two consecutive swims or runs, no consecutive breaks", () => {
  const segs = analyse().segments;
  for (let i = 1; i < segs.length; i++) {
    expect(segs[i].type !== segs[i - 1].type, `segments ${i} and ${i + 1} share a type`).toBeTruthy();
  }
});

it("Rhederlaag: segments cover the whole track without gaps", () => {
  const segs = analyse().segments;
  expect(segs[0].startTrackpointIndex).toEqual(0);
  for (let i = 1; i < segs.length; i++) {
    expect(segs[i].startTrackpointIndex).toEqual(segs[i - 1].endTrackpointIndex + 1);
  }
});

// Regression snapshot of the current algorithm. The real course has about 12 swims
// and 12 runs (to be confirmed); tighten these numbers when the algorithm gets there.
it("Rhederlaag: swim and run counts and totals (current baseline)", () => {
  const a = analyse();
  const count = (t: string) => a.segments.filter((s) => s.type === t).length;
  expect(count("swim")).toEqual(8);
  expect(count("run")).toEqual(8);
  expect(a.totals.totalRunKm).toEqual("9.0");
  expect(a.totals.totalSwimM).toEqual("1050");
});
