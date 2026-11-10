import type { ChatAgent, ChatEvent, ChatSuggestion } from "./chat-agent.ts";
import { freeformHint, isChromeBrowser } from "./chat-hints.ts";
import type { Lang } from "./language.ts";
import {
  type AssistantReply,
  assistAvailability,
  type LanguageModelStatic,
  proposeChange,
  warmUp,
} from "./prompt-api.ts";
import { type Day, type Move, type TrainingSession } from "./training-week.ts";

/** The texts the training agent needs; the page owns the translations. */
export interface TrainingAgentStrings {
  assistAbsent: string;
  assistUnavailable: string;
  assistDownloadable: string;
  assistEnable: string;
  assistDownloading: string;
  assistInstalled: string;
  assistFailed: string;
  proposalTitle: string;
  proposalEmpty: string;
  apply: string;
  applied: string;
  dismiss: string;
  dismissed: string;
  days: Record<Day, string>;
  movedFromTo: (title: string, from: string, to: string) => string;
}

export interface TrainingAgentOptions {
  model: LanguageModelStatic | null;
  lang: Lang;
  strings: TrainingAgentStrings;
  /** The current week, read on every message so manual changes are seen. */
  getWeek: () => readonly TrainingSession[];
  /** Called only after the athlete chose to apply a proposal. */
  onApply: (moves: Move[]) => void;
  chrome?: boolean;
}

const INSTALL = "install-model";
const APPLY = "apply-proposal";
const DISMISS = "dismiss-proposal";

/**
 * Chat agent that moves training sessions with Gemini Nano. It only proposes: moves are applied
 * through a follow-up the athlete chooses ("AI-assisted, not AI-dependent": every move can still
 * be made by hand). Without the model it explains why, in the athlete's language.
 */
export function createTrainingAgent(
  { model, lang, strings: t, getWeek, onApply, chrome = isChromeBrowser() }: TrainingAgentOptions,
): ChatAgent {
  let pending: Move[] = [];
  let lastInstruction = "";
  let round = 0;

  const proposalText = (moves: Move[]) =>
    moves.length === 0
      ? t.proposalEmpty
      : [
        t.proposalTitle,
        ...moves.flatMap((move) => {
          const session = getWeek().find((candidate) => candidate.id === move.id);
          return session
            ? [`${t.movedFromTo(session.title, t.days[session.day], t.days[move.toDay])}${move.reason ? ` — ${move.reason}` : ""}`]
            : [];
        }),
      ].join("\n");

  function reply(result: AssistantReply): ChatEvent {
    round++;
    if (result.kind === "clarification") {
      pending = [];
      return {
        type: "text",
        text: result.clarification.question,
        followUps: result.clarification.options.map((option) => ({
          id: `option-${round}-${option.id}`,
          label: option.label,
          prompt: `${lastInstruction} — I mean ${option.label} (session id "${option.id}").`,
        })),
      };
    }
    pending = result.moves;
    if (result.moves.length === 0) return { type: "text", text: t.proposalEmpty };
    const applyId = `apply-${round}`;
    const dismissId = `dismiss-${round}`;
    return {
      type: "text",
      text: proposalText(result.moves),
      followUps: [
        { id: applyId, label: t.apply, prompt: APPLY, completes: dismissId },
        { id: dismissId, label: t.dismiss, prompt: DISMISS, completes: applyId },
      ],
    };
  }

  const text = (value: string, followUps?: ChatSuggestion[]): ChatEvent =>
    followUps ? { type: "text", text: value, followUps } : { type: "text", text: value };

  return {
    suggestions: () => Promise.resolve([]),
    async *run(message: string) {
      yield { type: "run-started" };

      if (message === APPLY) {
        onApply(pending);
        pending = [];
        yield text(t.applied);
      } else if (message === DISMISS) {
        pending = [];
        yield text(t.dismissed);
      } else {
        const hint = freeformHint(lang, chrome);
        const availability = hint ? "absent" : await assistAvailability(model);
        if (hint) {
          yield text(hint);
        } else if (availability === "absent") {
          yield text(t.assistAbsent);
        } else if (availability === "unavailable") {
          yield text(t.assistUnavailable);
        } else if (message === INSTALL || availability === "downloadable" || availability === "downloading") {
          // A download is a multi-GB opt-in: ask first, then show its progress.
          if (message !== INSTALL && availability === "downloadable") {
            yield text(t.assistDownloadable, [{ id: `install-${++round}`, label: t.assistEnable, prompt: INSTALL }]);
          } else {
            try {
              let loaded = 0;
              const download = warmUp(model!, (progress) => (loaded = progress));
              // Report progress while the download runs; errors surface through the await below.
              let done = false;
              download.then(() => done = true, () => done = true);
              while (!done) {
                yield { type: "status", text: `${t.assistDownloading} ${Math.round(loaded * 100)}%` };
                await Promise.race([download.catch(() => {}), new Promise((resolve) => setTimeout(resolve, 500))]);
              }
              await download;
              yield text(t.assistInstalled);
            } catch {
              yield text(t.assistFailed);
            }
          }
        } else {
          if (!message.includes(" — I mean ")) lastInstruction = message;
          try {
            yield reply(await proposeChange(model!, getWeek(), message));
          } catch {
            yield text(t.assistFailed);
          }
        }
      }
      yield { type: "run-finished" };
    },
  };
}
