import { assertEquals } from "@std/assert";
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

Deno.test("cleanSegments: a swim that rounds to 0 m disappears into its neighbours", () => {
  const out = cleanSegments([seg("run", 1, 0), seg("swim", 0.01, 10), seg("run", 1, 20)]);
  assertEquals(out.map((s) => s.type), ["run"]);
  assertEquals(out[0].distanceKm, 2.01);
  assertEquals(out[0].endTrackpointIndex, 29);
});

Deno.test("cleanSegments: two swims separated by a break become one swim", () => {
  const out = cleanSegments([
    seg("run", 1, 0),
    seg("swim", 0.2, 10),
    seg("unclassified", 0.05, 20),
    seg("swim", 0.3, 30),
    seg("run", 1, 40),
  ]);
  assertEquals(out.map((s) => s.type), ["run", "swim", "run"]);
  assertEquals(out[1].distanceKm, 0.55);
});

Deno.test("cleanSegments: a break between a swim and a run is kept", () => {
  const out = cleanSegments([seg("swim", 0.2, 0), seg("unclassified", 0.1, 10), seg("run", 1, 20)]);
  assertEquals(out.map((s) => s.type), ["swim", "unclassified", "run"]);
});

Deno.test("cleanSegments: renumbers from 1", () => {
  const out = cleanSegments([seg("run", 1, 0), seg("swim", 0.2, 10), seg("run", 1, 20)]);
  assertEquals(out.map((s) => s.number), [1, 2, 3]);
});
