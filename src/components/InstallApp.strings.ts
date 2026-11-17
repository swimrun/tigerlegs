import type { Lang } from "../client/language.ts";
import { de } from "./InstallApp.strings.de.ts";
import { en } from "./InstallApp.strings.en.ts";
import { fr } from "./InstallApp.strings.fr.ts";
import { nl } from "./InstallApp.strings.nl.ts";

/** Every text of the button that installs the site as an app (issue #130). */
export interface Strings {
  /** Where the browser can show its own install prompt. */
  install: string;
  /** Where it cannot (Safari on iOS) and the person adds the site themselves. */
  addToHomeScreen: string;
  /** The explanation that the second button shows; the names of the menu items are the ones that iOS uses. */
  iosHint: string;
}

export const STRINGS: Record<Lang, Strings> = { en, nl, fr, de };
