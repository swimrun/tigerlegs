import { expect, it } from "vitest";
import { cleanSegments } from "../../src/client/segment-cleaner.ts";
import type { Segment, SegmentType } from "../../src/shared/types.ts";

function seg(type: SegmentType, distanceKm: number, start: number): Segment {
  return {
    number: 0,
    type,
    startTrackpointIndex: start,
    endTrackpointIndex: start + 9,
    distanceKm,
    detectedBy: ["speed"],
    confidenceScore: 0.5,
    gpsFiltered: false,
  };
}

it("cleanSegments: a swim that rounds to 0 m disappears into its neighbours", () => {
  const out = cleanSegments([seg("run", 1, 0), seg("swim", 0.01, 10), seg("run", 1, 20)]);
  expect(out.map((s) => s.type)).toEqual(["run"]);
  expect(out[0].distanceKm).toEqual(2.01);
  expect(out[0].endTrackpointIndex).toEqual(29);
});

it("cleanSegments: two swims separated by a break become one swim", () => {
  const out = cleanSegments([
    seg("run", 1, 0),
    seg("swim", 0.2, 10),
    seg("unclassified", 0.05, 20),
    seg("swim", 0.3, 30),
    seg("run", 1, 40),
  ]);
  expect(out.map((s) => s.type)).toEqual(["run", "swim", "run"]);
  expect(out[1].distanceKm).toEqual(0.55);
});

it("cleanSegments: a break between a swim and a run is kept", () => {
  const out = cleanSegments([seg("swim", 0.2, 0), seg("unclassified", 0.1, 10), seg("run", 1, 20)]);
  expect(out.map((s) => s.type)).toEqual(["swim", "unclassified", "run"]);
});

it("cleanSegments: renumbers from 1", () => {
  const out = cleanSegments([seg("run", 1, 0), seg("swim", 0.2, 10), seg("run", 1, 20)]);
  expect(out.map((s) => s.number)).toEqual([1, 2, 3]);
});
