import type { ProposalAction } from "./ui-catalog.ts";

/**
 * Chat boundary between the UI and whatever answers. The UI only knows `ChatAgent`, so the
 * FAQ agent below can later be replaced by an LLM behind AG-UI without touching the component.
 * The event names are a small subset of the AG-UI event types (RUN_STARTED, TEXT_MESSAGE_CONTENT,
 * RUN_FINISHED); tool calls and state deltas can be added the same way when agents drive the UI.
 * `ag-ui.ts` turns this stream into real AG-UI events with the `@ag-ui/core` package; the chat UI itself still
 * reads `ChatEvent`.
 */
export type ChatEvent =
  | { type: "run-started" }
  /** Progress while the agent works, e.g. a model download; shown next to the typing dots. */
  | { type: "status"; text: string }
  /**
   * `text` may use "# Heading" lines and consecutive "- item" lines, which the chat shows as a heading and a bulleted list.
   * `ui` is a declarative description of an interface to show under the text (ui-catalog.ts, ADR-0019): data, never
   * code. The text is always shown, so it also stands in for a description that the page cannot render.
   * `uiActions` says what the buttons of that interface send to the agent, as a chip does; an action that is not
   * listed has no button. `links` are buttons that open another page; the text always names them too.
   */
  | { type: "text"; text: string; followUps?: ChatSuggestion[]; ui?: unknown; uiActions?: UiActions; links?: ChatLink[] }
  | { type: "run-finished" };

/** A link under a message that takes the visitor to another page of the site. */
export interface ChatLink {
  label: string;
  href: string;
}

export type UiActions = Partial<Record<ProposalAction, ChatSuggestion>>;

export interface ChatSuggestion {
  id: string;
  label: string;
  /** What is sent to the agent when the label is chosen; defaults to the label. */
  prompt?: string;
  /** Id of the suggestion that counts as fully answered once this one is chosen. */
  completes?: string;
  /** A follow-up that stays on its message while later messages come, instead of only on the last one. */
  sticky?: boolean;
}

export interface ChatAgent {
  /** Async, because an agent may have to load its suggestions. */
  suggestions(): Promise<ChatSuggestion[]>;
  /** Answers one user message as a stream of events. */
  run(message: string): AsyncIterable<ChatEvent>;
}

export interface FaqEntry {
  id: string;
  question: string;
  answer: string;
  /** Longer answer, offered through a "Tell me more" follow-up. */
  more?: string;
}

/** Shape of `public/chat/faq.<lang>.json`. */
export interface FaqData {
  language: string;
  /** Label of the follow-up button that reveals the longer answer. */
  tellMore: string;
  fallback: string;
  entries: FaqEntry[];
}

const isText = (value: unknown): value is string => typeof value === "string" && value.length > 0;

/** Validates untrusted JSON; throws a readable error for anything that is not `FaqData`. */
export function parseFaq(json: unknown): FaqData {
  const data = json as Partial<FaqData> | null;
  if (!data || !isText(data.language) || !isText(data.tellMore) || !isText(data.fallback) || !Array.isArray(data.entries)) {
    throw new Error("FAQ must have a language, a tellMore label, a fallback text and a list of entries");
  }
  for (const entry of data.entries) {
    if (!entry || !isText(entry.id) || !isText(entry.question) || !isText(entry.answer)) {
      throw new Error("Every FAQ entry needs an id, a question and an answer");
    }
    if (entry.more !== undefined && !isText(entry.more)) throw new Error("An FAQ 'more' text must not be empty");
  }
  return { language: data.language, tellMore: data.tellMore, fallback: data.fallback, entries: data.entries };
}

const normalize = (text: string) => text.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, " ").trim();
const MORE_PREFIX = "more:";
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Typing pause: grows with the answer length, so long answers "take longer to type",
 * capped at three times the base delay. A zero base (tests) stays zero.
 */
const typingTime = (base: number, text: string) => Math.min(base * 3, base + text.length * 15);

export interface FaqAgentOptions {
  /** Pause before answering so the chat feels like a conversation. */
  delayMs?: number;
  /** Replaces the file's fallback text, e.g. with a hint about language or browser. */
  fallback?: string;
  fetcher?: typeof fetch;
}

/**
 * Agent that answers the questions in a FAQ JSON file and says so for anything else.
 * The file is fetched on first use, so the page does not wait for it.
 */
export function createFaqAgent(url: string, { delayMs = 700, fetcher = fetch, fallback }: FaqAgentOptions = {}): ChatAgent {
  let loaded: Promise<FaqData> | undefined;
  const load = () => {
    loaded ??= fetcher(url).then(async (response) => {
      if (!response.ok) throw new Error(`FAQ request failed with status ${response.status}`);
      return parseFaq(await response.json());
    });
    // A failed load is not cached, so the next attempt can retry.
    return loaded.catch((error) => {
      loaded = undefined;
      throw error;
    });
  };

  return {
    suggestions: async () => (await load()).entries.map(({ id, question }) => ({ id, label: question })),
    async *run(message: string) {
      yield { type: "run-started" };
      const faq = await load();
      const fallbackText = fallback ?? faq.fallback;
      let reply: ChatEvent;
      if (message.startsWith(MORE_PREFIX)) {
        const more = faq.entries.find((candidate) => candidate.id === message.slice(MORE_PREFIX.length))?.more;
        reply = { type: "text", text: more ?? fallbackText };
      } else {
        const entry = faq.entries.find((candidate) => normalize(candidate.question) === normalize(message));
        const text = entry?.answer ?? fallbackText;
        reply = entry?.more
          ? { type: "text", text, followUps: [{ id: `${entry.id}-more`, label: faq.tellMore, prompt: MORE_PREFIX + entry.id, completes: entry.id }] }
          : { type: "text", text };
      }
      // The typing indicator shows during this pause, so the chat feels like a conversation.
      await sleep(typingTime(delayMs, reply.type === "text" ? reply.text : ""));
      yield reply;
      yield { type: "run-finished" };
    },
  };
}
