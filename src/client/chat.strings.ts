import type { GuideTexts } from "./chat-guide.ts";
import type { Lang } from "./language.ts";
import { de } from "./chat.strings.de.ts";
import { en } from "./chat.strings.en.ts";
import { fr } from "./chat.strings.fr.ts";
import { nl } from "./chat.strings.nl.ts";

/** The texts of the chat: its interface, and why a free question cannot go to the model. One file per language next to this one. */
export interface ChatStrings {
  title: string;
  prototype: string;
  typing: string;
  suggested: string;
  yourQuestion: string;
  placeholder: string;
  ask: string;
  loadFailed: string;
  error: string;
  /** Shown when the browser is not Chrome on a desktop computer. */
  switchToChrome: string;
  /** Before the name of the page you are on. */
  youAreOn: string;
  /** The chip on every page that tells what the web app can do, and where. */
  guide: GuideTexts;
  /** Only for languages Gemini Nano does not support. */
  useSupportedLanguage?: string;
}

export const STRINGS: Record<Lang, ChatStrings> = { en, nl, fr, de };
