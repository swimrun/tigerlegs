import type { SegmentType, StrategyName } from "../../types.ts";
import { Trace, type TracePoint } from "../geometry.ts";
import {
  type AthleteId,
  assertInstant,
  assertText,
  type CourseId,
  DomainError,
  type GroupId,
  type Instant,
  type RecordingId,
} from "../kernel.ts";
import type { Visibility } from "../course/course.ts";

export type Source = "gpxUpload" | "fitUpload" | "provider";

/** Where a recording came from at a service (Strava, Garmin, Polar …), so that importing it twice is recognised. */
export interface ExternalRef {
  readonly provider: string;
  readonly externalId: string;
}

/** A swim or run found on the trace, over the points `startIndex` to `endIndex` (inclusive). */
export interface RecordedSegment {
  readonly kind: SegmentType;
  readonly startIndex: number;
  readonly endIndex: number;
  readonly distanceM: number;
  readonly durationS: number;
  readonly detectedBy: readonly StrategyName[];
  readonly confidence: number;
}

function checkSegments(segments: readonly RecordedSegment[], points: number): void {
  let previousEnd = -1;
  segments.forEach((segment, index) => {
    const label = `Segment ${index + 1}`;
    if (!Number.isInteger(segment.startIndex) || !Number.isInteger(segment.endIndex) || segment.startIndex < 0 || segment.startIndex > segment.endIndex) {
      throw new DomainError(`${label} must start at a point and not end before it starts`);
    }
    if (segment.endIndex >= points) throw new DomainError(`${label} points past the last position of the trace`);
    if (segment.startIndex <= previousEnd) throw new DomainError(`${label} must start after the previous segment ends`);
    previousEnd = segment.endIndex;
    if (!Number.isFinite(segment.distanceM) || segment.distanceM < 0) throw new DomainError(`${label}: distance must not be negative`);
    if (!Number.isFinite(segment.durationS) || segment.durationS < 0) throw new DomainError(`${label}: duration must not be negative`);
    if (!(segment.confidence >= 0 && segment.confidence <= 1)) throw new DomainError(`${label}: confidence must be from 0 to 1`);
  });
}

export interface RecordingSnapshot {
  id: string;
  ownerId: string;
  courseId: string | null;
  startedAt: Instant;
  source: Source;
  visibility: Visibility;
  sharedWith: string[];
  trace: TracePoint[];
  segments: RecordedSegment[];
  external: ExternalRef | null;
  version: number;
}

interface RecordingState {
  id: RecordingId;
  ownerId: AthleteId;
  courseId: CourseId | null;
  startedAt: Instant;
  source: Source;
  visibility: Visibility;
  sharedWith: readonly GroupId[];
  trace: Trace;
  segments: readonly RecordedSegment[];
  external: ExternalRef | null;
  version: number;
}

/**
 * The aggregate root of a recording, a carried-out track with its detected segments: personal data, private by
 * default. Invariants: it always has an owner; segments are ordered, do not overlap and point at positions of the
 * trace; groups are only listed when the recording is shared with groups. A trace is one value (thousands of
 * positions), so the aggregate stays small. One use case changes one recording and saves it once.
 */
export class Recording {
  private state: RecordingState;

  private constructor(state: RecordingState) {
    Recording.check(state);
    this.state = state;
  }

  private static check(state: RecordingState): void {
    assertText(state.ownerId, "A recording owner");
    assertInstant(state.startedAt, "startedAt");
    if (!["private", "group", "public"].includes(state.visibility)) throw new DomainError("Unknown visibility");
    if (state.visibility === "group" && state.sharedWith.length === 0) throw new DomainError("A recording shared with groups names at least one group");
    if (state.visibility !== "group" && state.sharedWith.length > 0) throw new DomainError("Groups are only listed when the recording is shared with groups");
    if (state.external !== null) {
      assertText(state.external.provider, "An external provider");
      assertText(state.external.externalId, "An external id");
    }
    checkSegments(state.segments, state.trace.points.length);
  }

  /** A new, private recording. */
  static create(spec: {
    id: RecordingId;
    ownerId: AthleteId;
    startedAt: Instant;
    source: Source;
    trace: Trace;
    segments?: readonly RecordedSegment[];
    courseId?: CourseId | null;
    external?: ExternalRef | null;
  }): Recording {
    return new Recording({
      id: spec.id,
      ownerId: spec.ownerId,
      courseId: spec.courseId ?? null,
      startedAt: spec.startedAt,
      source: spec.source,
      visibility: "private",
      sharedWith: [],
      trace: spec.trace,
      segments: Object.freeze([...(spec.segments ?? [])]),
      external: spec.external ?? null,
      version: 0,
    });
  }

  static fromSnapshot(snapshot: RecordingSnapshot): Recording {
    return new Recording({
      id: snapshot.id as RecordingId,
      ownerId: snapshot.ownerId as AthleteId,
      courseId: snapshot.courseId as CourseId | null,
      startedAt: snapshot.startedAt,
      source: snapshot.source,
      visibility: snapshot.visibility,
      sharedWith: snapshot.sharedWith as GroupId[],
      trace: new Trace(snapshot.trace),
      segments: Object.freeze(snapshot.segments.map((segment) => Object.freeze({ ...segment }))),
      external: snapshot.external,
      version: snapshot.version,
    });
  }

  toSnapshot(): RecordingSnapshot {
    return {
      id: this.state.id,
      ownerId: this.state.ownerId,
      courseId: this.state.courseId,
      startedAt: this.state.startedAt,
      source: this.state.source,
      visibility: this.state.visibility,
      sharedWith: [...this.state.sharedWith],
      trace: this.state.trace.points.map((point) => ({ ...point })),
      segments: this.state.segments.map((segment) => ({ ...segment, detectedBy: [...segment.detectedBy] })),
      external: this.state.external && { ...this.state.external },
      version: this.state.version,
    };
  }

  get id(): RecordingId {
    return this.state.id;
  }
  get ownerId(): AthleteId {
    return this.state.ownerId;
  }
  get courseId(): CourseId | null {
    return this.state.courseId;
  }
  get startedAt(): Instant {
    return this.state.startedAt;
  }
  get source(): Source {
    return this.state.source;
  }
  get visibility(): Visibility {
    return this.state.visibility;
  }
  get sharedWith(): readonly GroupId[] {
    return this.state.sharedWith;
  }
  get trace(): Trace {
    return this.state.trace;
  }
  get segments(): readonly RecordedSegment[] {
    return this.state.segments;
  }
  get external(): ExternalRef | null {
    return this.state.external;
  }
  get version(): number {
    return this.state.version;
  }

  private change(next: Partial<RecordingState>): void {
    const state = { ...this.state, ...next };
    Recording.check(state);
    this.state = state;
  }

  followCourse(courseId: CourseId | null): void {
    this.change({ courseId });
  }

  /** Shares the recording with a group; it stays visible to the groups already listed. */
  shareWith(group: GroupId): void {
    const groups = this.state.sharedWith.includes(group) ? this.state.sharedWith : [...this.state.sharedWith, group];
    this.change({ visibility: "group", sharedWith: groups });
  }

  makePrivate(): void {
    this.change({ visibility: "private", sharedWith: [] });
  }

  replaceSegments(segments: readonly RecordedSegment[]): void {
    this.change({ segments: Object.freeze(segments.map((segment) => Object.freeze({ ...segment }))) });
  }
}
