import { Worker } from "node:worker_threads";
import { expect, it } from "vitest";
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

it("analysis uses only the selected track and enabled strategies", () => {
  const analysis = analyzeGpx(gpx, [], {
    trackIndex: 1,
    enabledStrategies: ["speed"],
  });
  expect(analysis.trackName).toEqual("Second");
  expect(analysis.strategies).toEqual(["speed"]);
  expect(analysis.segments.at(-1)?.endTrackpointIndex).toEqual(19);
  const disabled = analyzeGpx(gpx, [], {
    trackIndex: 0,
    enabledStrategies: ["waypoint"],
  });
  expect(disabled.strategies).toEqual([]);
  expect(disabled.segments.map((segment) => segment.type)).toEqual([
    "unclassified",
  ]);
  expect(disabled.segments[0].detectedBy).toEqual([]);
  expect(() => analyzeGpx(gpx, [], { trackIndex: 5 })).toThrow(RangeError);
});

it("timestamps from a different track cannot enable speed for the selected track", () => {
  const copy: GPXData = {
    waypoints: [],
    tracks: [gpx.tracks[0], {
      name: "No time",
      trackpoints: points(5).map((p) => ({ ...p, timestamp: null })),
    }],
  };
  expect(analyzeGpx(copy, [], { trackIndex: 1 }).strategies).toEqual([]);
});

it("worker boundary is strictly above 10,000 points", () => {
  expect(requiresAnalysisWorker(10000)).toEqual(false);
  expect(requiresAnalysisWorker(10001)).toEqual(true);
});

it("large terrain bounding boxes do not exceed the JavaScript argument limit", () => {
  expect(coarseBbox(points(150000))).toEqual([-0.05, -0.05, 0.05, 1.55]);
});

it("synthetic 10,000-point local analysis completes within five seconds", () => {
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
  expect(elapsed < 5000, `Analysis took ${elapsed.toFixed(0)} ms`).toBeTruthy();
  expect(result.trackName).toEqual("Performance");
  expect(result.segments.at(-1)?.endTrackpointIndex).toEqual(9999);
});

it("confirmation and waypoint warnings use exact thresholds and all tracks", () => {
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
  expect(importWarnings(data)).toEqual({
    trackpoints: 50000,
    waypoints: 100,
    confirmationRequired: false,
    manyWaypoints: false,
    trackSelectionRequired: false,
  });
  data.waypoints.push(waypoint);
  data.tracks.push({ name: "", trackpoints: points(1) });
  expect(importWarnings(data)).toEqual({
    trackpoints: 50001,
    waypoints: 101,
    confirmationRequired: true,
    manyWaypoints: true,
    trackSelectionRequired: true,
  });
});

it("worker protocol surfaces invalid files and analysis errors", () => {
  const parse = processAnalysisJob({ kind: "parse", xml: "" });
  expect(parse.kind).toEqual("parse");
  expect(parse.result.ok).toEqual(false);
  const analysis = processAnalysisJob({
    kind: "analyze",
    gpx,
    water: [],
    options: { trackIndex: 99 },
  });
  expect(analysis.kind).toEqual("analyze");
  expect(analysis.result.ok).toEqual(false);
});

// The real analysis worker module is a Web Worker (it listens with addEventListener and answers with
// postMessage). Node's worker threads have another API, so a small shim gives the module the Web Worker
// functions it uses; the logic under test is the real module.
const WORKER_URL = new URL("../../src/client/analysis-worker.ts", import.meta.url).href;
const SHIM = `
const { parentPort } = require("node:worker_threads");
const listeners = [];
globalThis.addEventListener = (type, listener) => { if (type === "message") listeners.push(listener); };
globalThis.postMessage = (data) => parentPort.postMessage(data);
parentPort.on("message", (data) => listeners.forEach((listener) => listener({ data })));
import(${JSON.stringify(WORKER_URL)});
`;

async function workerJob(job: AnalysisJob): Promise<AnalysisReply> {
  const worker = new Worker(SHIM, { eval: true });
  try {
    return await new Promise<AnalysisReply>((resolve, reject) => {
      worker.on("message", (data: AnalysisReply) => resolve(data));
      worker.on("error", reject);
      worker.postMessage(job);
    });
  } finally {
    await worker.terminate();
  }
}

it("real module worker parses GPX and produces identical large-track analysis", async () => {
  const parsed = await workerJob({
    kind: "parse",
    xml:
      '<gpx><trk><name>Worker</name><trkseg><trkpt lat="0" lon="0"/></trkseg></trk></gpx>',
  });
  expect(parsed.kind === "parse" && parsed.result.ok).toBeTruthy();
  expect(parsed.result.value.tracks[0].name).toEqual("Worker");
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
  expect(actual.kind === "analyze" && actual.result.ok).toBeTruthy();
  expect(actual.result.value).toEqual(analyzeGpx(data, [], options));
});
