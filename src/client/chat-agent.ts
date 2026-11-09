/**
 * Chat boundary between the UI and whatever answers. The UI only knows `ChatAgent`, so the
 * FAQ agent below can later be replaced by an LLM behind AG-UI without touching the component.
 * The event names are a small subset of the AG-UI event types (RUN_STARTED, TEXT_MESSAGE_CONTENT,
 * RUN_FINISHED); tool calls and state deltas can be added the same way when agents drive the UI.
 */
export type ChatEvent =
  | { type: "run-started" }
  | { type: "text"; text: string; followUps?: ChatSuggestion[] }
  | { type: "run-finished" };

export interface ChatSuggestion {
  id: string;
  label: string;
  /** What is sent to the agent when the label is chosen; defaults to the label. */
  prompt?: string;
  /** Id of the suggestion that counts as fully answered once this one is chosen. */
  completes?: string;
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
  fetcher?: typeof fetch;
}

/**
 * Agent that answers the questions in a FAQ JSON file and says so for anything else.
 * The file is fetched on first use, so the page does not wait for it.
 */
export function createFaqAgent(url: string, { delayMs = 700, fetcher = fetch }: FaqAgentOptions = {}): ChatAgent {
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
      let reply: ChatEvent;
      if (message.startsWith(MORE_PREFIX)) {
        const more = faq.entries.find((candidate) => candidate.id === message.slice(MORE_PREFIX.length))?.more;
        reply = { type: "text", text: more ?? faq.fallback };
      } else {
        const entry = faq.entries.find((candidate) => normalize(candidate.question) === normalize(message));
        const text = entry?.answer ?? faq.fallback;
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
