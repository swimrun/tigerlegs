import { useId } from "react";
import type { ChangeProposalProps, ProposalAction } from "../client/ui-catalog.ts";
import type { Strings } from "./GenUi.strings.ts";

const ACTIONS: readonly ProposalAction[] = ["apply", "dismiss"];

/**
 * A proposal of the assistant in the chat: the changes as a list, with Apply and Dismiss as real buttons with
 * text labels. "Was" and "Now" are words, so no colour carries the meaning. The texts come from the page
 * (GenUi.strings), never from the agent. Only the actions in `actions` get a button (both, when it is left out),
 * so that a proposal that nothing can answer is a read-only card and not a button that does nothing.
 */
export default function ChangeProposal({
  title,
  changes,
  strings,
  onAction,
  actions = ACTIONS,
  disabled = false,
}: ChangeProposalProps & {
  strings: Strings;
  onAction: (action: ProposalAction) => void;
  actions?: readonly ProposalAction[];
  disabled?: boolean;
}) {
  const headingId = useId();
  const button = "rounded px-3 py-1.5 text-sm font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500 focus-visible:ring-offset-2";
  return (
    <section aria-labelledby={headingId} className="my-2 rounded border border-stone-300 bg-white p-3 text-sm text-stone-800">
      <h3 id={headingId} className="mb-2 font-semibold">{title}</h3>
      <ul className="mb-3 space-y-1">
        {changes.map((change, index) => (
          <li key={index}>
            <strong>{change.label}</strong>: <span>{strings.before}: {change.before}</span>
            <span aria-hidden="true"> → </span>
            <span>{strings.after}: {change.after}</span>
          </li>
        ))}
      </ul>
      {actions.length > 0 && (
        <div className="flex gap-2">
          {actions.includes("apply") && (
            <button type="button" disabled={disabled} className={`${button} bg-amber-500 text-white hover:bg-amber-600 disabled:opacity-60`} onClick={() => onAction("apply")}>
              {strings.apply}
            </button>
          )}
          {actions.includes("dismiss") && (
            <button type="button" disabled={disabled} className={`${button} border border-stone-300 text-stone-700 hover:bg-stone-100 disabled:opacity-60`} onClick={() => onAction("dismiss")}>
              {strings.dismiss}
            </button>
          )}
        </div>
      )}
    </section>
  );
}
