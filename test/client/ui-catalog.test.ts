import { expect, it } from "vitest";
import { MAX_CHANGES, MAX_TEXT, parseUiDescription } from "../../src/client/ui-catalog.ts";

const proposal = {
  component: "ChangeProposal",
  props: {
    title: "Proposed moves",
    changes: [{ label: "Tuesday", before: "Run 8 km", after: "Swim 2 km" }],
  },
};

it("a valid ChangeProposal is read", () => {
  const parsed = parseUiDescription(proposal);
  expect(parsed).toEqual({ ok: true, component: "ChangeProposal", props: proposal.props });
});

it("only the known fields survive; anything else that the agent sent is dropped", () => {
  const parsed = parseUiDescription({
    component: "ChangeProposal",
    onClick: "alert(1)",
    props: {
      title: "Moves",
      html: "<img src=x onerror=alert(1)>",
      changes: [{ label: "Tue", before: "a", after: "b", script: "evil()" }],
    },
  });
  expect(parsed).toEqual({
    ok: true,
    component: "ChangeProposal",
    props: { title: "Moves", changes: [{ label: "Tue", before: "a", after: "b" }] },
  });
});

it("a component outside the catalog is unknown, whatever its name", () => {
  for (const name of ["Carousel", "changeproposal", "constructor", "__proto__", "toString", ""]) {
    const parsed = parseUiDescription({ component: name, props: proposal.props });
    expect(parsed.ok, name).toBe(false);
    if (!parsed.ok) expect(parsed.reason, name).toBe("unknown-component");
  }
});

it("a description that is not valid says why", () => {
  const cases: Array<[string, unknown]> = [
    ["not an object", "ChangeProposal"],
    ["null", null],
    ["an array", [proposal]],
    ["no component name", { props: proposal.props }],
    ["a component name that is not text", { component: 7, props: proposal.props }],
    ["no props", { component: "ChangeProposal" }],
    ["props that are not an object", { component: "ChangeProposal", props: "x" }],
    ["no title", { component: "ChangeProposal", props: { changes: proposal.props.changes } }],
    ["an empty title", { component: "ChangeProposal", props: { ...proposal.props, title: "  " } }],
    ["no changes", { component: "ChangeProposal", props: { title: "T", changes: [] } }],
    ["changes that are not a list", { component: "ChangeProposal", props: { title: "T", changes: {} } }],
    ["a change without a label", { component: "ChangeProposal", props: { title: "T", changes: [{ before: "a", after: "b" }] } }],
    ["a change with a number", { component: "ChangeProposal", props: { title: "T", changes: [{ label: "L", before: 1, after: "b" }] } }],
    ["a change that is not an object", { component: "ChangeProposal", props: { title: "T", changes: ["x"] } }],
  ];
  for (const [name, value] of cases) {
    const parsed = parseUiDescription(value);
    expect(parsed.ok, name).toBe(false);
    if (!parsed.ok) {
      expect(parsed.reason, name).toBe("invalid");
      expect(parsed.detail.length, name).toBeGreaterThan(0);
    }
  }
});

it("the limits keep a description small", () => {
  const change = { label: "L", before: "a", after: "b" };
  expect(parseUiDescription({ component: "ChangeProposal", props: { title: "T", changes: Array(MAX_CHANGES).fill(change) } }).ok).toBe(true);
  expect(parseUiDescription({ component: "ChangeProposal", props: { title: "T", changes: Array(MAX_CHANGES + 1).fill(change) } }).ok).toBe(false);
  expect(parseUiDescription({ component: "ChangeProposal", props: { title: "x".repeat(MAX_TEXT), changes: [change] } }).ok).toBe(true);
  expect(parseUiDescription({ component: "ChangeProposal", props: { title: "x".repeat(MAX_TEXT + 1), changes: [change] } }).ok).toBe(false);
});

it("a change may add or remove something: before or after can be empty, the label cannot", () => {
  const props = (change: object) => ({ component: "ChangeProposal", props: { title: "T", changes: [change] } });
  expect(parseUiDescription(props({ label: "Thursday", before: "", after: "Rest day" })).ok).toBe(true);
  expect(parseUiDescription(props({ label: "Thursday", before: "Run", after: "" })).ok).toBe(true);
  expect(parseUiDescription(props({ label: "", before: "Run", after: "Swim" })).ok).toBe(false);
});

it("an invalid change is named by its number, so that the first and the second can be told apart", () => {
  const props = (changes: unknown[]) => ({ component: "ChangeProposal", props: { title: "T", changes } });
  const good = { label: "L", before: "a", after: "b" };
  const first = parseUiDescription(props([{ label: "" }, good]));
  const second = parseUiDescription(props([good, { label: "" }]));
  expect(first).toMatchObject({ ok: false, reason: "invalid", detail: expect.stringMatching(/^change 1 needs/) });
  expect(second).toMatchObject({ ok: false, reason: "invalid", detail: expect.stringMatching(/^change 2 needs/) });
});
