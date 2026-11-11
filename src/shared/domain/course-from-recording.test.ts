import { expect, it } from "vitest";
import { courseFromRecording } from "./course-from-recording.ts";
import { courseId, DomainError, variantId } from "./kernel.ts";
import { recording, segments } from "./test-data.ts";
import { Recording } from "./recording/recording.ts";

const spec = (trimStartM = 0, trimEndM = 0) => ({
  courseId: courseId("course-1"),
  variantId: variantId("race-day"),
  name: "Het Rondje Eilanden",
  description: "From a recording.",
  trimStartM,
  trimEndM,
});

it("a course from a recording has the line and the legs of the recording, and one canonical variant", () => {
  const created = courseFromRecording(recording(), spec());
  const variant = created.canonicalVariant();
  expect(created.variants.length).toEqual(1);
  expect(Math.abs(variant.line.lengthM() - recording().trace.distanceM()) < 1).toBeTruthy();
  expect(variant.legs.map((leg) => [leg.kind, leg.startIndex, leg.endIndex])).toEqual([["run", 0, 4], ["swim", 4, 6], ["run", 6, 10]]);
});

it("the course holds no time, no heart rate and no reference to the recording", () => {
  const json = JSON.stringify(courseFromRecording(recording("recording-secret"), spec()).toSnapshot());
  expect(!json.includes("heartRate") && !json.includes('"time"') && !json.includes("startedAt")).toBeTruthy();
  expect(!json.includes("recording-secret") && !json.includes("recordingId")).toBeTruthy();
});

it("the course is private and owned by the athlete until it is published", () => {
  const created = courseFromRecording(recording(), spec());
  expect(created.visibility).toEqual("private");
  expect(created.ownerId).toEqual("athlete-1");
  created.publish();
  expect(created.ownerId).toEqual(null);
});

it("trimming cuts the start and the end of the line and keeps the legs contiguous", () => {
  const created = courseFromRecording(recording(), spec(1500, 1500));
  const variant = created.canonicalVariant();
  expect(variant.line.points.length).toEqual(7);
  expect(variant.legs.map((leg) => [leg.kind, leg.startIndex, leg.endIndex])).toEqual([["run", 0, 2], ["swim", 2, 4], ["run", 4, 6]]);
  expect(variant.line.lengthM() < recording().trace.distanceM() - 2900).toBeTruthy();
});

it("a trimming that leaves no line is refused", () => {
  expect(() => courseFromRecording(recording(), spec(6000, 6000))).toThrow(DomainError);
  expect(() => courseFromRecording(recording(), spec(-1, 0))).toThrow(DomainError);
});

it("a recording without segments, or with an unclassified one, cannot become a course", () => {
  const bare = Recording.create({
    id: recording().id,
    ownerId: recording().ownerId,
    startedAt: recording().startedAt,
    source: "gpxUpload",
    trace: recording().trace,
  });
  expect(() => courseFromRecording(bare, spec())).toThrow(DomainError);
  const unclear = recording();
  unclear.replaceSegments([{ ...segments()[0], kind: "unclassified" }, ...segments().slice(1)]);
  expect(() => courseFromRecording(unclear, spec())).toThrow(DomainError);
});
