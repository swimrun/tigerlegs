import type { ReactNode } from "react";
import type { Lang } from "../client/language.ts";
import { parseUiDescription } from "../client/ui-catalog.ts";
import ChangeProposal, { type ProposalAction } from "./ChangeProposal.tsx";
import { STRINGS } from "./GenUi.strings.ts";

/**
 * Renders what an assistant asked to show, from the catalog of ui-catalog.ts, and nothing else.
 *
 * - A component that is not in the catalog is ignored, and the text of the message (`fallback`) is shown instead.
 * - A description that is not valid gets a sentence in words, and the text of the message stays visible, so the
 *   conversation continues.
 */
export default function GenUi({
  description,
  lang,
  fallback,
  onAction,
}: {
  description: unknown;
  lang: Lang;
  fallback?: ReactNode;
  onAction: (action: ProposalAction) => void;
}) {
  const parsed = parseUiDescription(description);
  if (!parsed.ok) {
    if (parsed.reason === "unknown-component") return <>{fallback}</>;
    return (
      <>
        <p role="status" className="text-sm text-stone-700">{STRINGS[lang].invalid}</p>
        {fallback}
      </>
    );
  }
  switch (parsed.component) {
    case "ChangeProposal":
      return <ChangeProposal {...parsed.props} strings={STRINGS[lang]} onAction={onAction} />;
  }
}
