import { expect, it } from "vitest";
import { courseId, DomainError, groupId } from "../kernel.ts";
import { recording, segments } from "../test-data.ts";
import { Recording } from "./recording.ts";

it("a new recording is private, has an owner and no groups", () => {
  const created = recording();
  expect(created.visibility).toEqual("private");
  expect(created.ownerId).toEqual("athlete-1");
  expect([...created.sharedWith]).toEqual([]);
  expect(created.version).toEqual(0);
});

it("segments must be ordered, not overlap and point at positions of the trace", () => {
  const created = recording();
  const [run, swim] = segments();
  expect(() => created.replaceSegments([swim, run])).toThrow(DomainError); // out of order
  expect(() => created.replaceSegments([run, { ...swim, startIndex: 3 }])).toThrow(DomainError); // overlap
  expect(() => created.replaceSegments([{ ...run, endIndex: 11 }])).toThrow(DomainError); // past the trace
  expect(() => created.replaceSegments([{ ...run, confidence: 1.5 }])).toThrow(DomainError);
  expect(created.segments.length, "a refused change leaves the segments as they were").toEqual(3);
  created.replaceSegments([run, swim]);
  expect(created.segments.length).toEqual(2);
});

it("sharing with a group makes the recording a group recording, and making it private forgets the groups", () => {
  const created = recording();
  created.shareWith(groupId("duo-1"));
  created.shareWith(groupId("duo-1"));
  created.shareWith(groupId("team-2"));
  expect(created.visibility).toEqual("group");
  expect([...created.sharedWith]).toEqual([groupId("duo-1"), groupId("team-2")]);
  created.makePrivate();
  expect(created.visibility).toEqual("private");
  expect([...created.sharedWith]).toEqual([]);
});

it("a recording can follow a course by id and stop following it", () => {
  const created = recording();
  created.followCourse(courseId("course-1"));
  expect(created.courseId).toEqual("course-1");
  created.followCourse(null);
  expect(created.courseId).toEqual(null);
});

it("an external reference needs a provider and an id", () => {
  expect(() =>
    Recording.create({
      id: recording().id,
      ownerId: recording().ownerId,
      startedAt: "2026-07-19T04:00:00.000Z",
      source: "provider",
      trace: recording().trace,
      external: { provider: "strava", externalId: " " },
    })).toThrow(DomainError);
});

it("a snapshot gives the same recording back", () => {
  const created = recording();
  created.shareWith(groupId("duo-1"));
  const snapshot = created.toSnapshot();
  expect(Recording.fromSnapshot(structuredClone(snapshot)).toSnapshot()).toEqual(snapshot);
  expect(snapshot.trace.every((point) => point.time && point.heartRate !== null)).toBeTruthy();
});
