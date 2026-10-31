import type { Segment } from "../shared/types.ts";

// Below these distances a segment rounds to 0 in the table (swim: 50 m steps, run: 0.1 km steps).
const MIN_SWIM_KM = 0.025;
const MIN_RUN_KM = 0.05;

function isTiny(seg: Segment): boolean {
  return (seg.type === "swim" && seg.distanceKm < MIN_SWIM_KM) ||
    (seg.type === "run" && seg.distanceKm < MIN_RUN_KM);
}

function join(a: Segment, b: Segment, type: Segment["type"]): Segment {
  const total = a.distanceKm + b.distanceKm;
  const weight = total > 0
    ? (a.confidenceScore * a.distanceKm + b.confidenceScore * b.distanceKm) / total
    : Math.max(a.confidenceScore, b.confidenceScore);
  return {
    ...a,
    type,
    endTrackpointIndex: b.endTrackpointIndex,
    distanceKm: total,
    detectedBy: [...new Set([...a.detectedBy, ...b.detectedBy])],
    confidenceScore: weight,
    ...((a.restDurationSeconds !== undefined || b.restDurationSeconds !== undefined)
      ? { restDurationSeconds: (a.restDurationSeconds ?? 0) + (b.restDurationSeconds ?? 0) }
      : {}),
  };
}

/**
 * Clean up detected segments:
 * - a swim or run that rounds to 0 is not a real segment and becomes a break;
 * - consecutive breaks are joined;
 * - two swims (or two runs) separated only by breaks become one segment, because
 *   a short pause (floating, eating) does not split a swim or run;
 * - segments are renumbered from 1.
 */
export function cleanSegments(segments: Segment[]): Segment[] {
  const out: Segment[] = [];
  for (const original of segments) {
    let seg: Segment = isTiny(original)
      ? { ...original, type: "unclassified" }
      : original;

    const last = out[out.length - 1];
    if (last && last.type === seg.type) {
      out[out.length - 1] = join(last, seg, seg.type);
      continue;
    }
    // swim, break, swim -> swim (the break is absorbed)
    const beforeBreak = out[out.length - 2];
    if (
      seg.type !== "unclassified" && last?.type === "unclassified" &&
      last.restDurationSeconds === undefined &&
      beforeBreak?.type === seg.type
    ) {
      out.pop();
      out[out.length - 1] = join(join(beforeBreak, last, seg.type), seg, seg.type);
      continue;
    }
    out.push(seg);
    seg = out[out.length - 1];
  }
  return out.map((s, i) => ({ ...s, number: i + 1 }));
}
