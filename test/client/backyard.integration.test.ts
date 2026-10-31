import { assert, assertEquals } from "@std/assert";
import { parseGPX } from "../../src/client/gpx-parser.ts";
import { analyzeGpx } from "../../src/client/analyze.ts";

Deno.test("Twiske: hourly rest interiors are not swims and do not join the three laps", () => {
  const parsed = parseGPX(Deno.readTextFileSync("test-data/Twiske_Backyard_SwimRun_Experience.gpx"));
  assert(parsed.ok);
  const points = parsed.value.tracks[0].trackpoints;
  const analysis = analyzeGpx(parsed.value);
  const rests = analysis.segments.filter(segment => segment.restDurationSeconds !== undefined);
  assertEquals(rests.length, 2);
  for (const index of [2800, 6200]) {
    const segment = analysis.segments.find(segment =>
      segment.startTrackpointIndex <= index && segment.endTrackpointIndex >= index
    );
    assertEquals(segment?.type, "unclassified");
    assert((segment?.restDurationSeconds ?? 0) >= 600);
  }
  for (const index of [1000, 4500, 8000]) {
    assert(!rests.some(rest => rest.startTrackpointIndex <= index && rest.endTrackpointIndex >= index));
  }
  assertEquals(analysis.segments[0].startTrackpointIndex, 0);
  assertEquals(analysis.segments.at(-1)?.endTrackpointIndex, points.length - 1);
  for (let i = 1; i < analysis.segments.length; i++) {
    assertEquals(analysis.segments[i].startTrackpointIndex, analysis.segments[i - 1].endTrackpointIndex + 1);
  }
});
