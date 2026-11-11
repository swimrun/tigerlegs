/**
 * The shared kernel of the stored domain model (software guidebook, sections 6.6 and 7.7): identifiers, time,
 * and the two errors of the model. Plain TypeScript with no framework, so that the browser and the back end can
 * both use it.
 */

/** A moment in time as an ISO 8601 string, which is how it travels in JSON and is stored. */
export type Instant = string;

type Brand<B extends string> = string & { readonly __brand: B };
export type CourseId = Brand<"CourseId">;
export type VariantId = Brand<"VariantId">;
export type RecordingId = Brand<"RecordingId">;
export type AthleteId = Brand<"AthleteId">;
export type GroupId = Brand<"GroupId">;

/** A rule of the model was broken: the aggregate or value was not created or changed. */
export class DomainError extends Error {}

/** Someone else saved the aggregate first: the version that was loaded is stale (first commit wins). */
export class ConflictError extends DomainError {}

function identifier<T extends string>(value: unknown, what: string): T {
  if (typeof value !== "string" || value.trim() === "") throw new DomainError(`A ${what} must not be empty`);
  return value as T;
}

export const courseId = (value: string): CourseId => identifier<CourseId>(value, "course id");
export const variantId = (value: string): VariantId => identifier<VariantId>(value, "variant id");
export const recordingId = (value: string): RecordingId => identifier<RecordingId>(value, "recording id");
export const athleteId = (value: string): AthleteId => identifier<AthleteId>(value, "athlete id");
export const groupId = (value: string): GroupId => identifier<GroupId>(value, "group id");

export function assertInstant(value: unknown, what: string): Instant {
  if (typeof value !== "string" || Number.isNaN(Date.parse(value))) {
    throw new DomainError(`${what} must be an ISO 8601 date and time`);
  }
  return value;
}

export function assertText(value: unknown, what: string): string {
  if (typeof value !== "string" || value.trim() === "") throw new DomainError(`${what} must not be empty`);
  return value;
}
