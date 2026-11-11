/**
 * Thin wrapper around Chrome's built-in Prompt API (Gemini Nano).
 *
 * The API is an enhancement, never a dependency ("AI-assisted, not
 * AI-dependent"): callers must work fully without it. Chrome owns the model
 * download and updates through its component updater; this module only
 * detects capability and prompts. Supported model languages are de, en, es,
 * fr and ja — the chat languages en/fr/de fit, Dutch does not (ADR-0010).
 */

import { LANGUAGE_NAMES, type Lang } from "./language.ts";
import {
  type Day,
  DAYS,
  fitsInstruction,
  isDay,
  type Move,
  mentionedDisciplines,
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

/** The output language to ask the model for: the page language when the model supports it, else all of them. */
const outputLanguages = (lang: Lang) => lang === "nl" ? LANGUAGES : [{ type: "text" as const, languages: [lang] }];

const SYSTEM_PROMPT = "You rearrange a weekly swimrun training schedule. " +
  "Never add, remove or alter sessions; only move them between days. " +
  "Propose exactly one move: the single most logical session for the athlete's instruction. " +
  "Only propose several moves when the instruction explicitly names more than one session to move. " +
  "Never place two runs on the same day; leave every session you were not asked about where it is. " +
  "When the instruction does not identify exactly one session (for example 'move the run' while " +
  "several runs exist), do not guess: return an empty moves array and a clarification with a short " +
  "question and one option per candidate session, labelling each with its name and current day. " +
  "Only offer candidates of the discipline the athlete mentions: when they say run, never offer a swim. " +
  "Rest days are days without any session: never move a session onto a rest day listed in the schedule. " +
  "When the athlete asks for a rest day on a day, return that day in restDays and no moves: the app moves the sessions itself.";

const REPLY_SCHEMA = {
  type: "object",
  properties: {
    restDays: { type: "array", items: { enum: [...DAYS] } },
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
    clarification: {
      type: "object",
      properties: {
        question: { type: "string" },
        options: {
          type: "array",
          items: {
            type: "object",
            properties: {
              id: { type: "string" },
              label: { type: "string" },
            },
            required: ["id", "label"],
          },
        },
      },
      required: ["question", "options"],
    },
  },
  required: ["moves"],
};

/** A follow-up question with candidate sessions, shown as suggestion chips. */
export interface Clarification {
  question: string;
  options: { id: string; label: string }[];
}

/** The assistant either proposes moves (or asks for rest days, which the app plans itself) or asks which session is meant. */
export type AssistantReply =
  | { kind: "moves"; moves: Move[]; restDays: Day[] }
  | { kind: "clarification"; clarification: Clarification };

/**
 * Parses a model response into a reply. A clarification wins when it carries a
 * question and at least two options naming real sessions; otherwise the moves
 * are parsed as before. Throws on malformed JSON.
 */
export function parseReply(json: string, week: readonly TrainingSession[]): AssistantReply {
  const parsed: unknown = JSON.parse(json);
  const clarification = (parsed as { clarification?: unknown })?.clarification as
    | Partial<Clarification>
    | undefined;
  if (clarification && typeof clarification.question === "string" && Array.isArray(clarification.options)) {
    const known = new Map(week.map((session) => [session.id, session]));
    const options = clarification.options.flatMap((option: unknown) => {
      const { id, label } = (option ?? {}) as Record<string, unknown>;
      if (typeof id !== "string" || !known.has(id)) return [];
      return [{ id, label: typeof label === "string" && label ? label : known.get(id)!.title }];
    });
    if (options.length >= 2) {
      return { kind: "clarification", clarification: { question: clarification.question, options } };
    }
  }
  const restDays = (parsed as { restDays?: unknown })?.restDays;
  return {
    kind: "moves",
    moves: parseProposal(json, week),
    restDays: Array.isArray(restDays) ? DAYS.filter((day) => restDays.some((candidate) => isDay(candidate) && candidate === day)) : [],
  };
}

/**
 * Drops clarification candidates that do not fit the discipline the instruction names ("run" never
 * offers a swim), whatever the model offered. Leaves everything alone when the instruction names no
 * discipline or no candidate fits.
 */
export function narrowByDiscipline(
  reply: AssistantReply,
  week: readonly TrainingSession[],
  instruction: string,
): AssistantReply {
  if (reply.kind !== "clarification") return reply;
  const mentioned = mentionedDisciplines(instruction);
  const byId = new Map(week.map((session) => [session.id, session]));
  const options = reply.clarification.options.filter((option) => {
    const session = byId.get(option.id);
    return session !== undefined && fitsInstruction(session, mentioned);
  });
  if (options.length === 0 || options.length === reply.clarification.options.length) return reply;
  return { kind: "clarification", clarification: { ...reply.clarification, options } };
}

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
 * reporting progress as 0..1) and asks for a reply: either moves or a
 * clarification question when the instruction is ambiguous.
 */
export async function proposeChange(
  model: LanguageModelStatic,
  week: readonly TrainingSession[],
  instruction: string,
  onDownloadProgress?: (loaded: number) => void,
  restDays: readonly Day[] = [],
  lang: Lang = "en",
): Promise<AssistantReply> {
  const reply = await askModel(model, week, instruction, onDownloadProgress, restDays, lang);
  // One candidate left after narrowing is no question: take it and ask again with that session named.
  if (reply.kind === "clarification" && reply.clarification.options.length === 1 && !instruction.includes("(session id ")) {
    const [only] = reply.clarification.options;
    return await askModel(model, week, `${instruction} — I mean ${only.label} (session id "${only.id}").`, onDownloadProgress, restDays, lang);
  }
  return reply;
}

async function askModel(
  model: LanguageModelStatic,
  week: readonly TrainingSession[],
  instruction: string,
  onDownloadProgress?: (loaded: number) => void,
  restDays: readonly Day[] = [],
  lang: Lang = "en",
): Promise<AssistantReply> {
  const session = await model.create({
    expectedInputs: LANGUAGES,
    expectedOutputs: outputLanguages(lang),
    initialPrompts: [{ role: "system", content: `${SYSTEM_PROMPT} Write every reason and every question in ${LANGUAGE_NAMES[lang]}.` }],
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
      `Schedule: ${JSON.stringify(schedule)}. Rest days: ${JSON.stringify(restDays)}. ${instruction} Propose moves.`,
      { responseConstraint: REPLY_SCHEMA },
    );
    return narrowByDiscipline(parseReply(response, week), week, instruction);
  } finally {
    session.destroy();
  }
}
