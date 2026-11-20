import type { Lang } from "../client/language.ts";
import { de } from "./GenUi.strings.de.ts";
import { en } from "./GenUi.strings.en.ts";
import { fr } from "./GenUi.strings.fr.ts";
import { nl } from "./GenUi.strings.nl.ts";

/** Every text of the components that an assistant can show in the chat (the catalog of ui-catalog.ts). */
export interface Strings {
  apply: string;
  dismiss: string;
  before: string;
  after: string;
  invalid: string;
}

export const STRINGS: Record<Lang, Strings> = { en, nl, fr, de };
