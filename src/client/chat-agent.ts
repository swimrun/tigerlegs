/**
 * Chat boundary between the UI and whatever answers. The UI only knows `ChatAgent`, so the
 * static FAQ below can later be replaced by an LLM behind AG-UI without touching the component.
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
  suggestions(): ChatSuggestion[];
  /** Answers one user message as a stream of events. */
  run(message: string): AsyncIterable<ChatEvent>;
}

export interface FaqEntry {
  id: string;
  question: string;
  answer: string;
}

export const FALLBACK_ANSWER =
  "Sorry I am not functional yet, just an idea. Please ask the static questions via the labels for now.";

export const FAQ: FaqEntry[] = [
  {
    id: "what-is-swimrun",
    question: "What is swimrun?",
    answer: "Swim, run, repeat. Teams (or soloists) move over a course that alternates between open-water swimming and trail running, in one go, with the same shoes and gear all the way.",
  },
  {
    id: "tigers-swim",
    question: "But can tigers actually swim?",
    answer: "Yes, and well. Tigers are among the few big cats that enjoy water: they cool off in it and swim across rivers. That is why a tiger is our swimrun mascot, and why the tiger in the logo is mid-swim.",
  },
  {
    id: "segment-count",
    question: "How many segments does a swimrun have?",
    answer: "It depends on the race. A short course may have a handful of swims and runs, a big island-hopping race has dozens. TigerLegs counts them for you: upload a GPX and it lists every swim and run segment.",
  },
  {
    id: "distances",
    question: "What are the distances in swimrun?",
    answer: "There are no standard distances. Every course is different: the swims can be a few hundred metres or several kilometres, and the runs anything from a short stretch of beach to long trails. That is exactly why measuring segments per course is useful.",
  },
  {
    id: "gear",
    question: "Do you swim in your running shoes?",
    answer: "Usually yes. Most swimrunners keep their shoes on and often use paddles and a pull buoy while swimming, plus a wetsuit that is easy to run in. More in our Substack series 'From zero till Ötillö': https://from0tillotillo.substack.com/",
  },
  {
    id: "tigerlegs-name",
    question: "What does TigerLegs stand for?",
    answer: "Terrain Informed Gpx ExtractoR: LEts Go Swimrun!",
  },
  {
    id: "privacy",
    question: "Is my GPX file uploaded?",
    answer: "No. The analysis runs in your browser. Terrain data from OpenStreetMap is opt-in, and then only a coarse bounding box is sent, never your trackpoints. See the About page for details.",
  },
];

const normalize = (text: string) => text.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, " ").trim();

/** Offline agent: answers only the known questions and says so for anything else. */
export function createFaqAgent(entries: FaqEntry[] = FAQ): ChatAgent {
  const byQuestion = new Map(entries.map((entry) => [normalize(entry.question), entry]));
  return {
    suggestions: () => entries.map(({ id, question }) => ({ id, label: question })),
    async *run(message: string) {
      yield { type: "run-started" };
      yield { type: "text", text: byQuestion.get(normalize(message))?.answer ?? FALLBACK_ANSWER };
      yield { type: "run-finished" };
    },
  };
}
