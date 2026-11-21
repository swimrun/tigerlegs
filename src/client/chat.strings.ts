import type { GuideTexts } from "./chat-guide.ts";
import { bundle } from "./i18n.ts";
import type { Lang } from "./language.ts";

/** The texts of the chat: its interface, and why a free question cannot go to the model. The texts are data in `src/data/chat.<language>.json` (ADR-0017). */
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
  /** The reply to a free question in the chat of every page except Training, which has the model. */
  freeQuestionsOnTraining: string;
  /** Before the name of the page you are on. */
  youAreOn: string;
  /** The chip on every page that tells what the web app can do, and where. */
  guide: GuideTexts;
  /** The chip that goes with the note for a language that Gemini Nano does not know: it switches the page to English. */
  switchToEnglish: string;
  /** Only for languages Gemini Nano does not support. */
  useSupportedLanguage?: string;
}

export const STRINGS: Record<Lang, ChatStrings> = { en: bundle("en", "chat"), nl: bundle("nl", "chat"), fr: bundle("fr", "chat"), de: bundle("de", "chat") };
