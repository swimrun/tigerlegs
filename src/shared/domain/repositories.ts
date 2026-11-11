import type { Course } from "./course/course.ts";
import type { AthleteId, CourseId, RecordingId } from "./kernel.ts";
import type { Recording } from "./recording/recording.ts";

/**
 * One repository per aggregate root; aggregates are loaded and saved whole. `save` throws a ConflictError when
 * the version of the aggregate is stale (first commit wins): reload and apply the change again.
 */
export interface CourseRepository {
  find(id: CourseId): Promise<Course | null>;
  add(course: Course): Promise<void>;
  save(course: Course): Promise<void>;
}

export interface RecordingRepository {
  find(id: RecordingId): Promise<Recording | null>;
  add(recording: Recording): Promise<void>;
  save(recording: Recording): Promise<void>;
  /** Removes every recording of an athlete (the erasure use case); returns how many were removed. */
  erase(owner: AthleteId): Promise<number>;
}
