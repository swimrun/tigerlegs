import { Course, type Leg } from "./course/course.ts";
import { CourseLine } from "./geometry.ts";
import { type CourseId, DomainError, type VariantId } from "./kernel.ts";
import type { Recording } from "./recording/recording.ts";

/**
 * Domain service: makes a course from a recording. It drops time and sensor data, trims the start and the end
 * (where a home address may be), and keeps no reference to the recording, so that erasing the recording does not
 * touch the course. The new course is private, owned by the recording's athlete, with the canonical variant;
 * `publish()` removes the owner.
 */
export function courseFromRecording(
  recording: Recording,
  spec: {
    courseId: CourseId;
    variantId: VariantId;
    name: string;
    description: string;
    /** Metres to cut off at the start and at the end. */
    trimStartM: number;
    trimEndM: number;
  },
): Course {
  if (!(spec.trimStartM >= 0) || !(spec.trimEndM >= 0)) throw new DomainError("Trimming must not be negative");
  const { points } = recording.trace;
  const cumulative = recording.trace.cumulativeM();
  const total = cumulative[cumulative.length - 1];
  const first = cumulative.findIndex((metres) => metres >= spec.trimStartM);
  let last = -1;
  cumulative.forEach((metres, index) => {
    if (metres <= total - spec.trimEndM) last = index;
  });
  if (first < 0 || last - first < 1) throw new DomainError("The trimming leaves no line");
  const line = new CourseLine(points.slice(first, last + 1).map(({ lat, lon, elevation }) => ({ lat, lon, elevation })));
  const end = line.points.length - 1;

  if (recording.segments.length === 0) throw new DomainError("A course needs the swims and runs of the recording: detect the segments first");
  if (recording.segments.some((segment) => segment.kind === "unclassified")) {
    throw new DomainError("Classify every segment as a swim or a run before making a course");
  }

  // The part of each segment that is left after trimming, in the points of the new line.
  const kept = recording.segments.flatMap((segment) => {
    const start = Math.max(segment.startIndex, first) - first;
    const stop = Math.min(segment.endIndex, last) - first;
    return start <= stop ? [{ kind: segment.kind as "swim" | "run", start }] : [];
  });
  if (kept.length === 0) throw new DomainError("The trimming leaves no swim or run");

  // Legs share their boundary points: each leg starts where the previous one ends.
  const legs: Leg[] = [];
  let cursor = 0;
  kept.forEach((part, index) => {
    const stop = index === kept.length - 1 ? end : kept[index + 1].start;
    if (stop <= cursor) return;
    legs.push({
      ordinal: legs.length + 1,
      kind: part.kind,
      startIndex: cursor,
      endIndex: stop,
      distanceM: line.distanceBetweenM(cursor, stop),
      name: null,
    });
    cursor = stop;
  });
  if (cursor !== end) legs[legs.length - 1] = { ...legs[legs.length - 1], endIndex: end, distanceM: line.distanceBetweenM(legs[legs.length - 1].startIndex, end) };

  return Course.create({
    id: spec.courseId,
    name: spec.name,
    visibility: "private",
    ownerId: recording.ownerId,
    variant: { id: spec.variantId, name: spec.name, description: spec.description, line, legs },
  });
}
