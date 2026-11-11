import { expect, it } from "vitest";
import { InMemoryCourseRepository, InMemoryRecordingRepository } from "./in-memory-repositories.ts";
import { athleteId, ConflictError, courseId, DomainError, recordingId } from "./kernel.ts";
import { course, recording } from "./test-data.ts";

it("a course that was added can be found, as a copy and not as the same object", async () => {
  const repository = new InMemoryCourseRepository();
  const original = course();
  await repository.add(original);
  const found = await repository.find(courseId("course-1"));
  expect(found !== null && found !== original).toBeTruthy();
  expect(found.toSnapshot()).toEqual(original.toSnapshot());
  expect(await repository.find(courseId("unknown"))).toEqual(null);
});

it("adding the same course twice, or saving one that was never added, is refused", async () => {
  const repository = new InMemoryCourseRepository();
  await repository.add(course());
  await expect((() => repository.add(course()))()).rejects.toThrow(DomainError);
  await expect((() => repository.save(course("course-2")))()).rejects.toThrow(DomainError);
});

it("first commit wins: a second save of a stale version is a conflict, and a reload makes it work", async () => {
  const repository = new InMemoryCourseRepository();
  await repository.add(course());
  const first = (await repository.find(courseId("course-1")))!;
  const second = (await repository.find(courseId("course-1")))!;
  first.rename("Renamed by the first");
  await repository.save(first);
  second.rename("Renamed by the second");
  await expect((() => repository.save(second))()).rejects.toThrow(ConflictError);
  expect((await repository.find(courseId("course-1")))!.name).toEqual("Renamed by the first");
  const reloaded = (await repository.find(courseId("course-1")))!;
  expect(reloaded.version).toEqual(1);
  reloaded.rename("Renamed after a reload");
  await repository.save(reloaded);
  expect((await repository.find(courseId("course-1")))!.version).toEqual(2);
});

it("what a repository stores is not changed by changing the aggregate afterwards", async () => {
  const repository = new InMemoryCourseRepository();
  const created = course();
  await repository.add(created);
  created.rename("Changed but not saved");
  expect((await repository.find(courseId("course-1")))!.name).toEqual("Het Rondje Eilanden");
});

it("erasing an athlete removes their recordings and only theirs", async () => {
  const repository = new InMemoryRecordingRepository();
  await repository.add(recording("recording-1"));
  await repository.add(recording("recording-2"));
  await repository.add(recording("recording-3", athleteId("athlete-2")));
  expect(await repository.erase(athleteId("athlete-1"))).toEqual(2);
  expect(await repository.find(recordingId("recording-1"))).toEqual(null);
  expect(await repository.find(recordingId("recording-3")) !== null).toBeTruthy();
  expect(await repository.erase(athleteId("athlete-1"))).toEqual(0);
});

it("recordings are saved with the same optimistic concurrency", async () => {
  const repository = new InMemoryRecordingRepository();
  await repository.add(recording());
  const first = (await repository.find(recordingId("recording-1")))!;
  const second = (await repository.find(recordingId("recording-1")))!;
  first.makePrivate();
  await repository.save(first);
  await expect((() => repository.save(second))()).rejects.toThrow(ConflictError);
});
