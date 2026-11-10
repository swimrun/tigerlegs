import type { Segment } from "../../src/shared/types.ts";

/** One leg of an official split: what it is and how long, in metres. */
export interface ExpectedLeg {
  readonly type: "run" | "swim";
  readonly meters: number;
  readonly name: string;
}

/**
 * Tolerances for comparing an analysis with an official split.
 *
 * - A leg may deviate by 10%, and by at least 50 m: official course maps round to 50 m, and a GPS
 *   track of a swim is longer than the straight line (wrist underwater, zigzag).
 * - A total may deviate by 3%. Two official sources for the Cannes race already differ by 1.1% for
 *   running (33.10 against 33.47 km) and 2.5% for swimming (7.30 against 7.48 km), so a test that
 *   is stricter than that would be stricter than the reference itself.
 */
export const legTolerance = (meters: number) => Math.max(50, meters * 0.1);
export const TOTAL_TOLERANCE = 0.03;

export const sum = (values: number[]) => values.reduce((total, value) => total + value, 0);

/** Compact picture of an analysis, for assertion messages and ratchets. */
export interface Summary {
  swims: number;
  runs: number;
  swimM: number;
  runM: number;
  unclassifiedM: number;
  /** One token per segment: s28 = swim of 28 m, r141 = run, u12 = unclassified. */
  shown: string;
}

export function summarize(segments: readonly Segment[]): Summary {
  const meters = (s: Segment) => s.distanceKm * 1000;
  const ofType = (type: Segment["type"]) => segments.filter((s) => s.type === type);
  return {
    swims: ofType("swim").length,
    runs: ofType("run").length,
    swimM: Math.round(sum(ofType("swim").map(meters))),
    runM: Math.round(sum(ofType("run").map(meters))),
    unclassifiedM: Math.round(sum(ofType("unclassified").map(meters))),
    shown: segments.map((s) => `${s.type[0]}${Math.round(meters(s))}`).join(" "),
  };
}

/** Why an analysis does not match the official split, or null when it does. */
export function mismatch(segments: readonly Segment[], expected: readonly ExpectedLeg[]): string | null {
  const found = segments.filter((s) => s.type !== "unclassified");
  const s = summarize(segments);
  const where = `found ${s.swims} swims (${s.swimM} m) and ${s.runs} runs (${s.runM} m): ${s.shown}`;
  const wantSwim = sum(expected.filter((l) => l.type === "swim").map((l) => l.meters));
  const wantRun = sum(expected.filter((l) => l.type === "run").map((l) => l.meters));
  if (Math.abs(s.swimM - wantSwim) > wantSwim * TOTAL_TOLERANCE) return `swim total ${s.swimM} m, expected ${wantSwim} m (±3%); ${where}`;
  if (Math.abs(s.runM - wantRun) > wantRun * TOTAL_TOLERANCE) return `run total ${s.runM} m, expected ${wantRun} m (±3%); ${where}`;
  if (found.map((f) => f.type).join() !== expected.map((l) => l.type).join()) return `leg types differ; ${where}`;
  for (let i = 0; i < expected.length; i++) {
    const actual = found[i].distanceKm * 1000;
    const leg = expected[i];
    if (Math.abs(actual - leg.meters) > legTolerance(leg.meters)) {
      return `leg ${leg.name}: ${Math.round(actual)} m, expected ${leg.meters} m (±${Math.round(legTolerance(leg.meters))}); ${where}`;
    }
  }
  return null;
}
