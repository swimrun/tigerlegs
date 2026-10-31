import { assert, assertEquals, assertThrows } from "@std/assert";
import { analyzeGpx } from "../../src/client/analyze.ts";
import {
  type AnalysisJob,
  type AnalysisReply,
  importWarnings,
  processAnalysisJob,
  requiresAnalysisWorker,
} from "../../src/client/analysis-job.ts";
import type { GPXData, Trackpoint, Waypoint } from "../../src/shared/types.ts";
import { coarseBbox } from "../../src/client/water.ts";

function points(count: number): Trackpoint[] {
  return Array.from({ length: count }, (_, index) => ({
    coordinate: { lat: 0, lon: index * 0.00001 },
    index,
    elevation: 0,
    timestamp: new Date(index * 1000).toISOString(),
  }));
}

const gpx: GPXData = {
  waypoints: [],
  tracks: [
    { name: "First", trackpoints: points(10) },
    { name: "Second", trackpoints: points(20) },
  ],
};

Deno.test("analysis uses only the selected track and enabled strategies", () => {
  const analysis = analyzeGpx(gpx, [], {
    trackIndex: 1,
    enabledStrategies: ["speed"],
  });
  assertEquals(analysis.trackName, "Second");
  assertEquals(analysis.strategies, ["speed"]);
  assertEquals(analysis.segments.at(-1)?.endTrackpointIndex, 19);
  const disabled = analyzeGpx(gpx, [], {
    trackIndex: 0,
    enabledStrategies: ["waypoint"],
  });
  assertEquals(disabled.strategies, []);
  assertEquals(disabled.segments.map((segment) => segment.type), [
    "unclassified",
  ]);
  assertEquals(disabled.segments[0].detectedBy, []);
  assertThrows(() => analyzeGpx(gpx, [], { trackIndex: 5 }), RangeError);
});

Deno.test("timestamps from a different track cannot enable speed for the selected track", () => {
  const copy: GPXData = {
    waypoints: [],
    tracks: [gpx.tracks[0], {
      name: "No time",
      trackpoints: points(5).map((p) => ({ ...p, timestamp: null })),
    }],
  };
  assertEquals(analyzeGpx(copy, [], { trackIndex: 1 }).strategies, []);
});

Deno.test("worker boundary is strictly above 10,000 points", () => {
  assertEquals(requiresAnalysisWorker(10000), false);
  assertEquals(requiresAnalysisWorker(10001), true);
});

Deno.test("large terrain bounding boxes do not exceed the JavaScript argument limit", () => {
  assertEquals(coarseBbox(points(150000)), [-0.05, -0.05, 0.05, 1.55]);
});

Deno.test("synthetic 10,000-point local analysis completes within five seconds", () => {
  const data: GPXData = {
    waypoints: [],
    tracks: [{ name: "Performance", trackpoints: points(10000) }],
  };
  const started = performance.now();
  const result = analyzeGpx(data, [], {
    trackIndex: 0,
    enabledStrategies: ["speed"],
  });
  const elapsed = performance.now() - started;
  assert(elapsed < 5000, `Analysis took ${elapsed.toFixed(0)} ms`);
  assertEquals(result.trackName, "Performance");
  assertEquals(result.segments.at(-1)?.endTrackpointIndex, 9999);
});

Deno.test("confirmation and waypoint warnings use exact thresholds and all tracks", () => {
  const waypoint: Waypoint = {
    coordinate: { lat: 0, lon: 0 },
    name: "",
    symbol: "",
    description: "",
    elevation: 0,
  };
  const data: GPXData = {
    waypoints: Array.from({ length: 100 }, () => waypoint),
    tracks: [{ name: "", trackpoints: points(50000) }],
  };
  assertEquals(importWarnings(data), {
    trackpoints: 50000,
    waypoints: 100,
    confirmationRequired: false,
    manyWaypoints: false,
    trackSelectionRequired: false,
  });
  data.waypoints.push(waypoint);
  data.tracks.push({ name: "", trackpoints: points(1) });
  assertEquals(importWarnings(data), {
    trackpoints: 50001,
    waypoints: 101,
    confirmationRequired: true,
    manyWaypoints: true,
    trackSelectionRequired: true,
  });
});

Deno.test("worker protocol surfaces invalid files and analysis errors", () => {
  const parse = processAnalysisJob({ kind: "parse", xml: "" });
  assertEquals(parse.kind, "parse");
  assertEquals(parse.result.ok, false);
  const analysis = processAnalysisJob({
    kind: "analyze",
    gpx,
    water: [],
    options: { trackIndex: 99 },
  });
  assertEquals(analysis.kind, "analyze");
  assertEquals(analysis.result.ok, false);
});

async function workerJob(job: AnalysisJob): Promise<AnalysisReply> {
  const worker = new Worker(
    new URL("../../src/client/analysis-worker.ts", import.meta.url),
    { type: "module" },
  );
  try {
    return await new Promise<AnalysisReply>((resolve, reject) => {
      worker.onmessage = (event: MessageEvent<AnalysisReply>) =>
        resolve(event.data);
      worker.onerror = (event) => {
        event.preventDefault();
        reject(new Error(event.message));
      };
      worker.postMessage(job);
    });
  } finally {
    worker.terminate();
  }
}

Deno.test("real module worker parses GPX and produces identical large-track analysis", async () => {
  const parsed = await workerJob({
    kind: "parse",
    xml:
      '<gpx><trk><name>Worker</name><trkseg><trkpt lat="0" lon="0"/></trkseg></trk></gpx>',
  });
  assert(parsed.kind === "parse" && parsed.result.ok);
  assertEquals(parsed.result.value.tracks[0].name, "Worker");
  const data: GPXData = {
    waypoints: [],
    tracks: [{ name: "Large", trackpoints: points(10001) }],
  };
  const options = { trackIndex: 0, enabledStrategies: ["speed"] as const };
  const actual = await workerJob({
    kind: "analyze",
    gpx: data,
    water: [],
    options,
  });
  assert(actual.kind === "analyze" && actual.result.ok);
  assertEquals(actual.result.value, analyzeGpx(data, [], options));
});
