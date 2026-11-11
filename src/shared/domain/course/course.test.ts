import { expect, it } from "vitest";
import { athleteId, courseId, DomainError, variantId } from "../kernel.ts";
import { course, legs, line } from "../test-data.ts";
import { Course, type Leg } from "./course.ts";

const second = () => ({ id: variantId("training"), name: "Training", description: "Swim A is run.", line: line(), legs: legs() });

it("a new course is private, has no owner, and its first variant is the canonical one", () => {
  const created = course();
  expect(created.visibility).toEqual("private");
  expect(created.ownerId).toEqual(null);
  expect(created.version).toEqual(0);
  expect(created.canonicalVariant().id).toEqual("race-day");
  expect(created.variants.filter((variant) => variant.canonical).length).toEqual(1);
});

it("a course has exactly one canonical variant: making another canonical moves the flag", () => {
  const created = course();
  created.addVariant(second());
  expect(created.canonicalVariant().id).toEqual("race-day");
  created.makeCanonical(variantId("training"));
  expect(created.canonicalVariant().id).toEqual("training");
  expect(created.variants.filter((variant) => variant.canonical).length).toEqual(1);
});

it("the canonical variant cannot be removed, another can", () => {
  const created = course();
  created.addVariant(second());
  expect(() => created.removeVariant(variantId("race-day"))).toThrow(DomainError);
  created.removeVariant(variantId("training"));
  expect(created.variants.length).toEqual(1);
  expect(() => created.removeVariant(variantId("unknown"))).toThrow(DomainError);
});

it("variant ids are different", () => {
  const created = course();
  expect(() => created.addVariant({ ...second(), id: variantId("race-day") })).toThrow(DomainError);
});

it("a failed change leaves the course as it was", () => {
  const created = course();
  expect(() => created.rename(" ")).toThrow(DomainError);
  expect(created.name).toEqual("Het Rondje Eilanden");
});

it("legs must be ordered, contiguous and cover the line", () => {
  const good = legs();
  const bad = (change: (list: Leg[]) => unknown) => {
    const copy = structuredClone(good);
    change(copy);
    return () => course().addVariant({ ...second(), legs: copy });
  };
  expect(bad((l) => l[1] = { ...l[1], startIndex: 5 })).toThrow(DomainError); // a gap
  expect(bad((l) => l[2] = { ...l[2], endIndex: 9 })).toThrow(DomainError); // does not reach the last point
  expect(bad((l) => l[0] = { ...l[0], ordinal: 2 })).toThrow(DomainError); // numbering
  expect(bad((l) => l.length = 0)).toThrow(DomainError); // no legs
});

it("leg distances must match the line within the tolerance", () => {
  const long = legs().map((leg) => ({ ...leg, distanceM: leg.distanceM * 1.2 }));
  expect(() => course().addVariant({ ...second(), legs: long })).toThrow(DomainError);
  const close = legs().map((leg) => ({ ...leg, distanceM: leg.distanceM * 1.03 }));
  course().addVariant({ ...second(), legs: close });
});

it("a variant's distances add up per kind", () => {
  const variant = course().canonicalVariant();
  expect(Math.abs(variant.distanceM() - variant.line.lengthM()) < 1).toBeTruthy();
  expect(variant.distanceOf("swim") > 0 && variant.distanceOf("run") > variant.distanceOf("swim")).toBeTruthy();
});

it("a variant needs a description, and its validity must make sense", () => {
  expect(() => course().addVariant({ ...second(), description: "" })).toThrow(DomainError);
  const ok = course();
  ok.addVariant({ ...second(), validity: { fromYear: 2025, toYear: null, months: [4, 5, 6] } });
  expect(() => course().addVariant({ ...second(), validity: { fromYear: 2026, toYear: 2025, months: [] } })).toThrow(DomainError);
  expect(() => course().addVariant({ ...second(), validity: { fromYear: null, toYear: null, months: [13] } })).toThrow(DomainError);
  expect(() => course().addVariant({ ...second(), validity: { fromYear: null, toYear: null, months: [4, 4] } })).toThrow(DomainError);
});

it("only a private course may have an owner, and publishing removes it", () => {
  const owned = Course.create({
    id: courseId("course-2"),
    name: "Mine",
    ownerId: athleteId("athlete-1"),
    variant: second(),
  });
  expect(owned.ownerId).toEqual("athlete-1");
  owned.publish();
  expect(owned.visibility).toEqual("public");
  expect(owned.ownerId).toEqual(null);
  expect(() =>
    Course.create({ id: courseId("course-3"), name: "Leak", visibility: "public", ownerId: athleteId("athlete-1"), variant: second() })).toThrow(DomainError);
});

it("a snapshot gives the same course back, and carries nothing but the course", () => {
  const created = course();
  created.addVariant({ ...second(), validity: { fromYear: 2025, toYear: null, months: [4, 5, 6] } });
  const snapshot = created.toSnapshot();
  expect(Course.fromSnapshot(structuredClone(snapshot)).toSnapshot()).toEqual(snapshot);
  const json = JSON.stringify(snapshot);
  expect(!json.includes("heartRate") && !json.includes('"time"')).toBeTruthy();
});
