import { expect, it } from "vitest";
import { barLegs, formatLegDistance, formatLegDuration, legLabel } from "../../src/client/legs-bar.ts";
import type { Segment, Trackpoint } from "../../src/shared/types.ts";

const segment = (number: number, type: Segment["type"], start: number, end: number, distanceKm: number): Segment => ({
  number, type, startTrackpointIndex: start, endTrackpointIndex: end, distanceKm, detectedBy: ["speed"], confidenceScore: 1, gpsFiltered: false,
});
const point = (second: number | null): Trackpoint => ({
  coordinate: { lat: 52, lon: 4 },
  timestamp: second === null ? null : new Date(Date.UTC(2026, 0, 1, 12, 0, second)).toISOString(),
} as Trackpoint);

it("barLegs: shares add up to 1 and each leg starts where the one before ends", () => {
  const legs = barLegs([segment(1, "run", 0, 9, 4), segment(2, "swim", 10, 19, 1), segment(3, "run", 20, 29, 5)], []);
  expect(legs.map((leg) => leg.share)).toEqual([0.4, 0.1, 0.5]);
  expect(legs.map((leg) => leg.start)).toEqual([0, 0.4, 0.5]);
});

it("barLegs: the duration comes from the timestamps, and is null without them", () => {
  const points = Array.from({ length: 30 }, (_, i) => point(i * 10));
  expect(barLegs([segment(1, "swim", 10, 19, 1)], points)[0].durationSeconds).toEqual(90);
  expect(barLegs([segment(1, "swim", 0, 9, 1)], Array.from({ length: 30 }, () => point(null)))[0].durationSeconds).toEqual(null);
});

it("barLegs: no distance gives zero shares and no NaN", () => {
  expect(barLegs([segment(1, "run", 0, 1, 0)], []).map((leg) => leg.share)).toEqual([0]);
  expect(barLegs([], [])).toEqual([]);
});

it("formatLegDistance: metres below a kilometre, kilometres from one", () => {
  expect(formatLegDistance(0.147)).toEqual("150 m");
  expect(formatLegDistance(1.3)).toEqual("1.30 km");
  expect(formatLegDistance(4.19)).toEqual("4.19 km");
});

it("formatLegDuration: seconds, minutes and hours", () => {
  expect(formatLegDuration(45)).toEqual("45 s");
  expect(formatLegDuration(1949)).toEqual("32 min 29 s");
  expect(formatLegDuration(3720)).toEqual("1 h 2 min");
});

it("legLabel: reads type, number, distance and duration", () => {
  const names = { swim: "swim", run: "run", unclassified: "break", leg: "leg" };
  const [leg] = barLegs([segment(3, "swim", 0, 1, 1.3)], [point(0), point(1949)]);
  expect(legLabel(leg, names)).toEqual("swim, leg 3, 1.30 km, 32 min 29 s");
  expect(legLabel({ ...leg, durationSeconds: null }, names)).toEqual("swim, leg 3, 1.30 km");
});
