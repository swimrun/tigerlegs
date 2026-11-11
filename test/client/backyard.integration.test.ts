import { expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { parseGPX } from "../../src/client/gpx-parser.ts";
import { analyzeGpx } from "../../src/client/analyze.ts";

it("Twiske: hourly rest interiors are not swims and do not join the three laps", () => {
  const parsed = parseGPX(readFileSync("test-data/Twiske_Backyard_SwimRun_Experience.gpx", "utf8"));
  expect(parsed.ok).toBeTruthy();
  const points = parsed.value.tracks[0].trackpoints;
  const analysis = analyzeGpx(parsed.value);
  const rests = analysis.segments.filter(segment => segment.restDurationSeconds !== undefined);
  expect(rests.length).toEqual(2);
  for (const index of [2800, 6200]) {
    const segment = analysis.segments.find(segment =>
      segment.startTrackpointIndex <= index && segment.endTrackpointIndex >= index
    );
    expect(segment?.type).toEqual("unclassified");
    expect((segment?.restDurationSeconds ?? 0) >= 600).toBeTruthy();
  }
  for (const index of [1000, 4500, 8000]) {
    expect(!rests.some(rest => rest.startTrackpointIndex <= index && rest.endTrackpointIndex >= index)).toBeTruthy();
  }
  expect(analysis.segments[0].startTrackpointIndex).toEqual(0);
  expect(analysis.segments.at(-1)?.endTrackpointIndex).toEqual(points.length - 1);
  for (let i = 1; i < analysis.segments.length; i++) {
    expect(analysis.segments[i].startTrackpointIndex).toEqual(analysis.segments[i - 1].endTrackpointIndex + 1);
  }
});
