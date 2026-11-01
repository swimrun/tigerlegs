/**
 * Chat boundary between the UI and whatever answers. The UI only knows `ChatAgent`, so the
 * FAQ agent below can later be replaced by an LLM behind AG-UI without touching the component.
 * The event names are a small subset of the AG-UI event types (RUN_STARTED, TEXT_MESSAGE_CONTENT,
 * RUN_FINISHED); tool calls and state deltas can be added the same way when agents drive the UI.
 */
export type ChatEvent =
  | { type: "run-started" }
  | { type: "text"; text: string }
  | { type: "run-finished" };

export interface ChatSuggestion {
  id: string;
  label: string;
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
}

/** Shape of `public/chat/faq.json`. */
export interface FaqData {
  fallback: string;
  entries: FaqEntry[];
}

const isText = (value: unknown): value is string => typeof value === "string" && value.length > 0;

/** Validates untrusted JSON; throws a readable error for anything that is not `FaqData`. */
export function parseFaq(json: unknown): FaqData {
  const data = json as Partial<FaqData> | null;
  if (!data || !isText(data.fallback) || !Array.isArray(data.entries)) {
    throw new Error("FAQ must have a fallback text and a list of entries");
  }
  for (const entry of data.entries) {
    if (!entry || !isText(entry.id) || !isText(entry.question) || !isText(entry.answer)) {
      throw new Error("Every FAQ entry needs an id, a question and an answer");
    }
  }
  return { fallback: data.fallback, entries: data.entries };
}

const normalize = (text: string) => text.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, " ").trim();
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

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
      await sleep(delayMs);
      const entry = faq.entries.find((candidate) => normalize(candidate.question) === normalize(message));
      yield { type: "text", text: entry?.answer ?? faq.fallback };
      yield { type: "run-finished" };
    },
  };
}
