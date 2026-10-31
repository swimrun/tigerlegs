import type { Segment, Trackpoint } from "../shared/types.ts";
import { haversineDistance } from "../shared/distance-calculator.ts";

export interface RestSpan {
  start: number;
  end: number;
  seconds: number;
}

/** Sustained spatial confinement, not accumulated GPS distance, identifies a rest candidate. */
export function detectRestSpans(points: Trackpoint[], radiusM = 50, minimumSeconds = 600): RestSpan[] {
  const spans: RestSpan[] = [];
  let start = 0;
  const time = (index: number) => Date.parse(points[index].timestamp ?? "");
  for (let end = 1; end <= points.length; end++) {
    const valid = end < points.length && Number.isFinite(time(end)) &&
      Number.isFinite(time(end - 1)) && time(end) > time(end - 1) &&
      haversineDistance(points[start].coordinate, points[end].coordinate) * 1000 <= radiusM;
    if (valid) continue;
    const seconds = time(end - 1) - time(start);
    if (seconds >= minimumSeconds * 1000) {
      const previous = spans.at(-1);
      if (previous && previous.end + 1 === start) {
        previous.end = end - 1;
        previous.seconds = (time(previous.end) - time(previous.start)) / 1000;
      } else {
        spans.push({ start, end: end - 1, seconds: seconds / 1000 });
      }
    }
    start = end;
  }
  return spans;
}

export function splitAtRests(segments: Segment[], rests: RestSpan[], points: Trackpoint[]): Segment[] {
  const result: Segment[] = [];
  for (const segment of segments) {
    let start = segment.startTrackpointIndex;
    for (const rest of rests) {
      const from = Math.max(start, rest.start);
      const to = Math.min(segment.endTrackpointIndex, rest.end);
      if (from > to) continue;
      if (start < from) result.push({ ...segment, startTrackpointIndex: start, endTrackpointIndex: from - 1 });
      result.push({
        ...segment,
        type: "unclassified",
        startTrackpointIndex: from,
        endTrackpointIndex: to,
        restDurationSeconds: (Date.parse(points[to].timestamp!) - Date.parse(points[from].timestamp!)) / 1000,
      });
      start = to + 1;
    }
    if (start <= segment.endTrackpointIndex) {
      result.push({ ...segment, startTrackpointIndex: start });
    }
  }
  return result;
}
