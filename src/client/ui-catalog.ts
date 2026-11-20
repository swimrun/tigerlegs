/**
 * The catalog of interface components that an assistant may ask the chat to show (issue #128, ADR-0019).
 * The agent sends a declarative description, which is data; the page renders it from the components listed
 * here. The agent never sends code, and a description that names a component outside the catalog, or that is
 * not valid, is not rendered. The first version uses a simple format of our own, with A2UI's names where they
 * fit.
 *
 * This is the base catalog: what any chat may show, so its components are neutral and hold no concept of one
 * part of the application. There is one renderer, and a page will add the components of its own to this base (a
 * week preview on the training page, say); a component outside the catalog of the page is not rendered.
 */
export const UI_CATALOG = ["ChangeProposal"] as const;
export type UiComponentName = typeof UI_CATALOG[number];

/** What the person can do with a proposal. What each action sends to the agent is up to the agent (`uiActions`). */
export type ProposalAction = "apply" | "dismiss";

/** Limits that keep a description small and a page readable, whatever an agent sends. */
export const MAX_TEXT = 200;
export const MAX_CHANGES = 20;

export interface Change {
  label: string;
  before: string;
  after: string;
}

/** A proposal of the assistant: what would change, to be applied or dismissed by the person. */
export interface ChangeProposalProps {
  title: string;
  changes: Change[];
}

export type UiParse =
  | { ok: true; component: "ChangeProposal"; props: ChangeProposalProps }
  | { ok: false; reason: "unknown-component" | "invalid"; detail: string };

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const isText = (value: unknown, allowEmpty = false): value is string =>
  typeof value === "string" && value.length <= MAX_TEXT && (allowEmpty || value.trim().length > 0);

/** The proposal with only the fields we know; anything else that the agent sent is dropped. */
function parseChangeProposal(props: unknown): ChangeProposalProps | string {
  if (!isRecord(props)) return "props must be an object";
  if (!isText(props.title)) return `title must be text of 1 to ${MAX_TEXT} characters`;
  if (!Array.isArray(props.changes) || props.changes.length === 0 || props.changes.length > MAX_CHANGES) {
    return `changes must be a list of 1 to ${MAX_CHANGES} items`;
  }
  const changes: Change[] = [];
  for (const [index, change] of props.changes.entries()) {
    if (!isRecord(change) || !isText(change.label) || !isText(change.before, true) || !isText(change.after, true)) {
      return `change ${index + 1} needs a label, a before and an after as text of at most ${MAX_TEXT} characters`;
    }
    changes.push({ label: change.label, before: change.before, after: change.after });
  }
  return { title: props.title, changes };
}

/** Reads a description from an agent, for example `{ component: "ChangeProposal", props: { ... } }`. */
export function parseUiDescription(value: unknown): UiParse {
  if (!isRecord(value) || typeof value.component !== "string") {
    return { ok: false, reason: "invalid", detail: "a description needs the name of a component" };
  }
  const name = UI_CATALOG.find((candidate) => candidate === value.component);
  if (name === undefined) return { ok: false, reason: "unknown-component", detail: value.component };
  const props = parseChangeProposal(value.props);
  if (typeof props === "string") return { ok: false, reason: "invalid", detail: props };
  return { ok: true, component: name, props };
}
