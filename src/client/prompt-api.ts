/**
 * Thin wrapper around Chrome's built-in Prompt API (Gemini Nano).
 *
 * The API is an enhancement, never a dependency ("AI-assisted, not
 * AI-dependent"): callers must work fully without it. Chrome owns the model
 * download and updates through its component updater; this module only
 * detects capability and prompts. Supported model languages are de, en, es,
 * fr and ja — the chat languages en/fr/de fit, Dutch does not (ADR-0010).
 */

import {
  DAYS,
  type Move,
  parseProposal,
  type TrainingSession,
} from "./training-week.ts";

/** Availability as reported by the browser, or "absent" when the API is missing. */
export type AssistAvailability =
  | "absent"
  | "unavailable"
  | "downloadable"
  | "downloading"
  | "available";

export interface LanguageModelSession {
  prompt(
    input: string,
    options?: { responseConstraint?: unknown },
  ): Promise<string>;
  destroy(): void;
}

interface CreateMonitor {
  addEventListener(
    type: "downloadprogress",
    listener: (event: { loaded: number }) => void,
  ): void;
}

export interface LanguageModelStatic {
  availability(options?: {
    expectedInputs?: { type: "text"; languages: string[] }[];
    expectedOutputs?: { type: "text"; languages: string[] }[];
  }): Promise<Exclude<AssistAvailability, "absent">>;
  create(options?: {
    expectedInputs?: { type: "text"; languages: string[] }[];
    expectedOutputs?: { type: "text"; languages: string[] }[];
    initialPrompts?: { role: "system"; content: string }[];
    monitor?(monitor: CreateMonitor): void;
  }): Promise<LanguageModelSession>;
}

/** The Prompt API entry point, or null when this browser has none. */
export function getLanguageModel(
  globals: object = globalThis,
): LanguageModelStatic | null {
  const candidate = (globals as { LanguageModel?: unknown }).LanguageModel;
  return candidate ? (candidate as LanguageModelStatic) : null;
}

export async function assistAvailability(
  model: LanguageModelStatic | null,
): Promise<AssistAvailability> {
  if (!model) return "absent";
  try {
    // Chrome wants the language expectations on every request, availability() included.
    return await model.availability({ expectedInputs: LANGUAGES, expectedOutputs: LANGUAGES });
  } catch {
    // Older API versions do not take options yet.
    return await model.availability();
  }
}

/** Model languages shared with the site: English, French and German (no Dutch). */
const LANGUAGES = [{ type: "text" as const, languages: ["en", "fr", "de"] }];

const SYSTEM_PROMPT = "You rearrange a weekly swimrun training schedule. " +
  "Never add, remove or alter sessions; only move them between days. " +
  "Propose exactly one move: the single most logical session for the athlete's instruction. " +
  "Only propose several moves when the instruction explicitly names more than one session to move. " +
  "Never place two runs on the same day; leave every session you were not asked about where it is.";

const MOVES_SCHEMA = {
  type: "object",
  properties: {
    moves: {
      type: "array",
      items: {
        type: "object",
        properties: {
          id: { type: "string" },
          toDay: { enum: [...DAYS] },
          reason: { type: "string" },
        },
        required: ["id", "toDay", "reason"],
      },
    },
  },
  required: ["moves"],
};

/**
 * Creates and immediately destroys a session, which triggers the one-off
 * model download when needed; progress is reported as 0..1.
 */
export async function warmUp(
  model: LanguageModelStatic,
  onDownloadProgress?: (loaded: number) => void,
): Promise<void> {
  const session = await model.create({
    expectedInputs: LANGUAGES,
    expectedOutputs: LANGUAGES,
    monitor(monitor) {
      monitor.addEventListener(
        "downloadprogress",
        (event) => onDownloadProgress?.(event.loaded),
      );
    },
  });
  session.destroy();
}

/**
 * Creates a session (which triggers the one-off model download when needed,
 * reporting progress as 0..1), asks for moves and returns the valid ones.
 */
export async function proposeMoves(
  model: LanguageModelStatic,
  week: readonly TrainingSession[],
  instruction: string,
  onDownloadProgress?: (loaded: number) => void,
): Promise<Move[]> {
  const session = await model.create({
    expectedInputs: LANGUAGES,
    expectedOutputs: LANGUAGES,
    initialPrompts: [{ role: "system", content: SYSTEM_PROMPT }],
    monitor(monitor) {
      monitor.addEventListener(
        "downloadprogress",
        (event) => onDownloadProgress?.(event.loaded),
      );
    },
  });
  try {
    const schedule = week.map(({ id, day, title }) => ({
      id,
      day,
      what: title,
    }));
    const response = await session.prompt(
      `Schedule: ${JSON.stringify(schedule)}. ${instruction} Propose moves.`,
      { responseConstraint: MOVES_SCHEMA },
    );
    return parseProposal(response, week);
  } finally {
    session.destroy();
  }
}
