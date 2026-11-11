import { Course, type CourseSnapshot } from "./course/course.ts";
import { ConflictError, type AthleteId, type CourseId, DomainError, type RecordingId } from "./kernel.ts";
import { Recording, type RecordingSnapshot } from "./recording/recording.ts";
import type { CourseRepository, RecordingRepository } from "./repositories.ts";

/**
 * Repositories that keep snapshots in memory. They are the test double of a database and the specification of
 * what a real repository must do: store a copy (never the object), check the version on save, and add one to it.
 */
function save<T extends { id: string; version: number }>(store: Map<string, T>, snapshot: T, what: string): void {
  const stored = store.get(snapshot.id);
  if (!stored) throw new DomainError(`${what} ${snapshot.id} does not exist: add it first`);
  if (stored.version !== snapshot.version) {
    throw new ConflictError(`${what} ${snapshot.id} was changed by someone else (version ${stored.version}, yours ${snapshot.version})`);
  }
  store.set(snapshot.id, structuredClone({ ...snapshot, version: snapshot.version + 1 }));
}

function add<T extends { id: string }>(store: Map<string, T>, snapshot: T, what: string): void {
  if (store.has(snapshot.id)) throw new DomainError(`${what} ${snapshot.id} already exists`);
  store.set(snapshot.id, structuredClone(snapshot));
}

export class InMemoryCourseRepository implements CourseRepository {
  private readonly store = new Map<string, CourseSnapshot>();

  // The methods are async so that a broken rule is a rejected promise, as it is with a real database.
  async find(id: CourseId): Promise<Course | null> {
    const snapshot = this.store.get(id);
    return snapshot ? Course.fromSnapshot(structuredClone(snapshot)) : null;
  }

  async add(course: Course): Promise<void> {
    add(this.store, course.toSnapshot(), "Course");
  }

  async save(course: Course): Promise<void> {
    save(this.store, course.toSnapshot(), "Course");
  }
}

export class InMemoryRecordingRepository implements RecordingRepository {
  private readonly store = new Map<string, RecordingSnapshot>();

  async find(id: RecordingId): Promise<Recording | null> {
    const snapshot = this.store.get(id);
    return snapshot ? Recording.fromSnapshot(structuredClone(snapshot)) : null;
  }

  async add(recording: Recording): Promise<void> {
    add(this.store, recording.toSnapshot(), "Recording");
  }

  async save(recording: Recording): Promise<void> {
    save(this.store, recording.toSnapshot(), "Recording");
  }

  async erase(owner: AthleteId): Promise<number> {
    let removed = 0;
    for (const [id, snapshot] of this.store) {
      if (snapshot.ownerId === owner) {
        this.store.delete(id);
        removed++;
      }
    }
    return removed;
  }
}
