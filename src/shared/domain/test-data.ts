import { CourseLine, Trace, type TracePoint } from "./geometry.ts";
import { athleteId, courseId, recordingId, variantId } from "./kernel.ts";
import { Course, type Leg } from "./course/course.ts";
import { Recording, type RecordedSegment } from "./recording/recording.ts";

/** Builders for the tests of the domain model: an eleven-point track along the equator, 0.01 degrees apart (about 1.1 km). */
export const OWNER = athleteId("athlete-1");

export function tracePoints(count = 11): TracePoint[] {
  return Array.from({ length: count }, (_, index) => ({
    lat: 0,
    lon: index * 0.01,
    elevation: 5,
    time: new Date(Date.UTC(2026, 6, 19, 4, index)).toISOString(),
    heartRate: 140 + index,
  }));
}

/** Run over points 0 to 3, swim over 4 to 5, run over 6 to 10. */
export function segments(): RecordedSegment[] {
  const part = (kind: "run" | "swim", startIndex: number, endIndex: number): RecordedSegment => ({
    kind,
    startIndex,
    endIndex,
    distanceM: (endIndex - startIndex) * 1111.95,
    durationS: (endIndex - startIndex) * 60,
    detectedBy: ["speed"],
    confidence: 0.9,
  });
  return [part("run", 0, 3), part("swim", 4, 5), part("run", 6, 10)];
}

export function recording(id = "recording-1", owner = OWNER): Recording {
  return Recording.create({
    id: recordingId(id),
    ownerId: owner,
    startedAt: "2026-07-19T04:00:00.000Z",
    source: "gpxUpload",
    trace: new Trace(tracePoints()),
    segments: segments(),
  });
}

export function line(count = 11): CourseLine {
  return new CourseLine(tracePoints(count).map(({ lat, lon, elevation }) => ({ lat, lon, elevation })));
}

/** Run over points 0 to 4, swim 4 to 6, run 6 to 10, with the distances of the line. */
export function legs(theLine: CourseLine = line()): Leg[] {
  const leg = (ordinal: number, kind: "run" | "swim", startIndex: number, endIndex: number): Leg => ({
    ordinal,
    kind,
    startIndex,
    endIndex,
    distanceM: theLine.distanceBetweenM(startIndex, endIndex),
    name: null,
  });
  return [leg(1, "run", 0, 4), leg(2, "swim", 4, 6), leg(3, "run", 6, 10)];
}

export function course(id = "course-1"): Course {
  return Course.create({
    id: courseId(id),
    name: "Het Rondje Eilanden",
    variant: { id: variantId("race-day"), name: "Race day", description: "The race day line.", line: line(), legs: legs() },
  });
}
