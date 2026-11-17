import { useId, useState, useSyncExternalStore } from "react";
import { installStore } from "../client/install.ts";
import { STRINGS } from "./InstallApp.strings.ts";
import { usePageLang } from "./usePageLang.ts";

const noop = () => () => {};

/**
 * A small button in the footer that installs the site as an app (issue #130, ADR-0021). It is only there when
 * something can be done: where the browser offers an install prompt, the button shows it; on iOS, where there is
 * no prompt, the button explains the Share menu. It never shows itself on its own, so there is nothing to nag.
 */
export default function InstallApp() {
  const lang = usePageLang();
  const t = STRINGS[lang];
  const store = installStore();
  const offer = useSyncExternalStore(store?.subscribe ?? noop, () => store?.offer() ?? "none", () => "none");
  const [hint, setHint] = useState(false);
  const hintId = useId();
  if (offer === "none") return null;
  return (
    <>
      {" · "}
      {offer === "prompt"
        ? <button type="button" className="underline" onClick={() => void store?.prompt()}>{t.install}</button>
        : (
          <>
            <button type="button" className="underline" aria-expanded={hint} aria-controls={hintId} onClick={() => setHint(!hint)}>
              {t.addToHomeScreen}
            </button>
            <span id={hintId} hidden={!hint}>{" "}{t.iosHint}</span>
          </>
        )}
    </>
  );
}
