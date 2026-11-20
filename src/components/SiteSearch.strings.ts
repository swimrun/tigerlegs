import type { Lang } from "../client/language.ts";
import { de } from "./SiteSearch.strings.de.ts";
import { en } from "./SiteSearch.strings.en.ts";
import { fr } from "./SiteSearch.strings.fr.ts";
import { nl } from "./SiteSearch.strings.nl.ts";

/** Every text of the search box in the header (ADR-0022). */
export interface Strings {
  label: string;
  placeholder: string;
  results: string;
  noResults: string;
  /** Before the first build there is no index, because Pagefind runs after the build. */
  unavailable: string;
}

export const STRINGS: Record<Lang, Strings> = { en, nl, fr, de };
