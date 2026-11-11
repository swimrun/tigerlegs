import { CourseLine, type LinePoint } from "../geometry.ts";
import { type AthleteId, assertText, type CourseId, DomainError, type VariantId } from "../kernel.ts";

export type Visibility = "private" | "group" | "public";
export type LegKind = "swim" | "run";

/** One swim or run of a variant, over the points `startIndex` to `endIndex` of its line (inclusive). */
export interface Leg {
  readonly ordinal: number;
  readonly kind: LegKind;
  readonly startIndex: number;
  readonly endIndex: number;
  readonly distanceM: number;
  readonly name: string | null;
}

/** When a variant applies: some editions (years) and some months; empty means always. */
export interface Validity {
  readonly fromYear: number | null;
  readonly toYear: number | null;
  readonly months: readonly number[];
}

/** The leg distances may differ this much from the length of the line (official distances are rounded). */
export const DISTANCE_TOLERANCE = 0.05;

function checkValidity(validity: Validity | null): void {
  if (validity === null) return;
  const { fromYear, toYear, months } = validity;
  for (const year of [fromYear, toYear]) {
    if (year !== null && (!Number.isInteger(year) || year < 1900 || year > 2200)) throw new DomainError("A year must be a whole year");
  }
  if (fromYear !== null && toYear !== null && fromYear > toYear) throw new DomainError("fromYear must not be after toYear");
  if (months.some((month) => !Number.isInteger(month) || month < 1 || month > 12) || new Set(months).size !== months.length) {
    throw new DomainError("Months must be different whole numbers from 1 to 12");
  }
}

/** Legs are ordered and contiguous, cover the line from start to end, and add up to its length within a tolerance. */
function checkLegs(line: CourseLine, legs: readonly Leg[]): void {
  if (legs.length === 0) throw new DomainError("A variant needs at least one leg");
  const last = line.points.length - 1;
  legs.forEach((leg, index) => {
    if (leg.ordinal !== index + 1) throw new DomainError("Legs must be numbered 1, 2, 3, … in order");
    if (leg.kind !== "swim" && leg.kind !== "run") throw new DomainError("A leg is a swim or a run");
    if (!Number.isInteger(leg.startIndex) || !Number.isInteger(leg.endIndex) || leg.startIndex >= leg.endIndex) {
      throw new DomainError(`Leg ${leg.ordinal} must start before it ends`);
    }
    if (!Number.isFinite(leg.distanceM) || leg.distanceM < 0) throw new DomainError(`Leg ${leg.ordinal}: distance must not be negative`);
    const expectedStart = index === 0 ? 0 : legs[index - 1].endIndex;
    if (leg.startIndex !== expectedStart) throw new DomainError(`Leg ${leg.ordinal} must start where the previous leg ends`);
  });
  if (legs[legs.length - 1].endIndex !== last) throw new DomainError("The legs must cover the line to its last point");
  const total = legs.reduce((sum, leg) => sum + leg.distanceM, 0);
  const length = line.lengthM();
  if (Math.abs(total - length) > DISTANCE_TOLERANCE * length) {
    throw new DomainError(`The leg distances (${Math.round(total)} m) must match the line (${Math.round(length)} m) within ${DISTANCE_TOLERANCE * 100}%`);
  }
}

export interface VariantSpec {
  id: VariantId;
  name: string;
  description: string;
  line: CourseLine;
  legs: readonly Leg[];
  validity?: Validity | null;
}

export interface CourseVariantSnapshot {
  id: string;
  name: string;
  description: string;
  canonical: boolean;
  validity: Validity | null;
  line: LinePoint[];
  legs: Leg[];
}

/** One way of doing a course (race day, training, high water, breeding season …). Immutable. */
export class CourseVariant {
  readonly id: VariantId;
  readonly name: string;
  readonly description: string;
  readonly canonical: boolean;
  readonly validity: Validity | null;
  readonly line: CourseLine;
  readonly legs: readonly Leg[];

  constructor(spec: VariantSpec & { canonical: boolean }) {
    this.id = spec.id;
    this.name = assertText(spec.name, "A variant name");
    this.description = assertText(spec.description, "A variant description");
    this.canonical = spec.canonical;
    checkValidity(spec.validity ?? null);
    this.validity = spec.validity ? Object.freeze({ ...spec.validity, months: Object.freeze([...spec.validity.months]) }) : null;
    checkLegs(spec.line, spec.legs);
    this.line = spec.line;
    this.legs = Object.freeze(spec.legs.map((leg) => Object.freeze({ ...leg })));
    Object.freeze(this);
  }

  distanceM(): number {
    return this.legs.reduce((sum, leg) => sum + leg.distanceM, 0);
  }

  distanceOf(kind: LegKind): number {
    return this.legs.filter((leg) => leg.kind === kind).reduce((sum, leg) => sum + leg.distanceM, 0);
  }

  withCanonical(canonical: boolean): CourseVariant {
    return new CourseVariant({ ...this, canonical });
  }

  toSnapshot(): CourseVariantSnapshot {
    return {
      id: this.id,
      name: this.name,
      description: this.description,
      canonical: this.canonical,
      validity: this.validity && { ...this.validity, months: [...this.validity.months] },
      line: this.line.points.map(({ lat, lon, elevation }) => ({ lat, lon, elevation })),
      legs: this.legs.map((leg) => ({ ...leg })),
    };
  }

  static fromSnapshot(snapshot: CourseVariantSnapshot): CourseVariant {
    return new CourseVariant({
      id: snapshot.id as VariantId,
      name: snapshot.name,
      description: snapshot.description,
      canonical: snapshot.canonical,
      validity: snapshot.validity,
      line: new CourseLine(snapshot.line),
      legs: snapshot.legs,
    });
  }
}

export interface CourseSnapshot {
  id: string;
  name: string;
  visibility: Visibility;
  ownerId: string | null;
  variants: CourseVariantSnapshot[];
  version: number;
}

interface CourseState {
  id: CourseId;
  name: string;
  visibility: Visibility;
  ownerId: AthleteId | null;
  variants: readonly CourseVariant[];
  version: number;
}

/**
 * The aggregate root of a course, an idealized track (software guidebook, section 6.6).
 * Invariants: exactly one canonical variant; a course holds no personal data, so an owner is only allowed on a
 * private course; every variant keeps its own rules (legs contiguous and covering the line). One use case changes
 * one course and saves it once; a stale version on save is a ConflictError.
 */
export class Course {
  private state: CourseState;

  private constructor(state: CourseState) {
    Course.check(state);
    this.state = state;
  }

  private static check(state: CourseState): void {
    assertText(state.name, "A course name");
    if (!["private", "group", "public"].includes(state.visibility)) throw new DomainError("Unknown visibility");
    if (state.ownerId !== null && state.visibility !== "private") {
      throw new DomainError("Only a private course may have an owner: a shared course holds no personal data");
    }
    if (state.variants.length === 0) throw new DomainError("A course needs at least one variant");
    if (state.variants.filter((variant) => variant.canonical).length !== 1) throw new DomainError("A course needs exactly one canonical variant");
    if (new Set(state.variants.map((variant) => variant.id)).size !== state.variants.length) throw new DomainError("Variant ids must be different");
  }

  /** A new course: its first variant is the canonical one. */
  static create(spec: {
    id: CourseId;
    name: string;
    visibility?: Visibility;
    ownerId?: AthleteId | null;
    variant: VariantSpec;
  }): Course {
    return new Course({
      id: spec.id,
      name: spec.name,
      visibility: spec.visibility ?? "private",
      ownerId: spec.ownerId ?? null,
      variants: [new CourseVariant({ ...spec.variant, canonical: true })],
      version: 0,
    });
  }

  static fromSnapshot(snapshot: CourseSnapshot): Course {
    return new Course({
      id: snapshot.id as CourseId,
      name: snapshot.name,
      visibility: snapshot.visibility,
      ownerId: snapshot.ownerId as AthleteId | null,
      variants: snapshot.variants.map((variant) => CourseVariant.fromSnapshot(variant)),
      version: snapshot.version,
    });
  }

  toSnapshot(): CourseSnapshot {
    return {
      id: this.state.id,
      name: this.state.name,
      visibility: this.state.visibility,
      ownerId: this.state.ownerId,
      variants: this.state.variants.map((variant) => variant.toSnapshot()),
      version: this.state.version,
    };
  }

  get id(): CourseId {
    return this.state.id;
  }
  get name(): string {
    return this.state.name;
  }
  get visibility(): Visibility {
    return this.state.visibility;
  }
  get ownerId(): AthleteId | null {
    return this.state.ownerId;
  }
  get variants(): readonly CourseVariant[] {
    return this.state.variants;
  }
  get version(): number {
    return this.state.version;
  }

  canonicalVariant(): CourseVariant {
    return this.state.variants.find((variant) => variant.canonical)!;
  }

  private change(next: Partial<CourseState>): void {
    const state = { ...this.state, ...next };
    Course.check(state);
    this.state = state;
  }

  rename(name: string): void {
    this.change({ name });
  }

  addVariant(spec: VariantSpec): VariantId {
    this.change({ variants: [...this.state.variants, new CourseVariant({ ...spec, canonical: false })] });
    return spec.id;
  }

  makeCanonical(id: VariantId): void {
    if (!this.state.variants.some((variant) => variant.id === id)) throw new DomainError(`Unknown variant ${id}`);
    this.change({ variants: this.state.variants.map((variant) => variant.withCanonical(variant.id === id)) });
  }

  removeVariant(id: VariantId): void {
    const variant = this.state.variants.find((candidate) => candidate.id === id);
    if (!variant) throw new DomainError(`Unknown variant ${id}`);
    if (variant.canonical) throw new DomainError("The canonical variant cannot be removed: make another variant canonical first");
    this.change({ variants: this.state.variants.filter((candidate) => candidate.id !== id) });
  }

  /** Makes the course public: it has no owner any more, because a shared course holds no personal data. */
  publish(): void {
    this.change({ visibility: "public", ownerId: null });
  }
}
