import { expect, it } from "vitest";
import { CourseLine, Trace } from "./geometry.ts";
import { DomainError } from "./kernel.ts";
import { line, tracePoints } from "./test-data.ts";

it("a line has the length of its positions", () => {
  // Ten steps of 0.01 degrees of longitude on the equator are about 11.12 km.
  expect(Math.abs(line().lengthM() - 11119.5) < 5).toBeTruthy();
  expect(line().distanceBetweenM(0, 5) * 2).toEqual(line().lengthM());
});

it("a line needs two points with valid positions", () => {
  expect(() => new CourseLine([{ lat: 0, lon: 0, elevation: null }])).toThrow(DomainError);
  expect(() => new CourseLine([{ lat: 91, lon: 0, elevation: null }, { lat: 0, lon: 0, elevation: null }])).toThrow(DomainError);
  expect(() => new CourseLine([{ lat: 0, lon: 181, elevation: null }, { lat: 0, lon: 0, elevation: null }])).toThrow(DomainError);
});

it("a line is immutable", () => {
  const points = line().points;
  expect(() => (points as unknown as { lat: number }[])[0].lat = 1).toThrow(TypeError);
});

it("a trace has a duration and a distance, and its cumulative distances end at the distance", () => {
  const trace = new Trace(tracePoints());
  expect(trace.durationS()).toEqual(600);
  expect(trace.cumulativeM()[trace.points.length - 1]).toEqual(trace.distanceM());
});

it("a trace's time must not go back and must be a date", () => {
  const points = tracePoints();
  points[3] = { ...points[3], time: "2026-07-19T03:00:00.000Z" };
  expect(() => new Trace(points)).toThrow(DomainError);
  expect(() => new Trace([{ ...points[0], time: "yesterday" }, points[1]])).toThrow(DomainError);
});
