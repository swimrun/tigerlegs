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
import {
  applyMoves,
  checkMoves,
  type Day,
  type IssueKind,
  type Move,
  planRestDay,
  restDaysRequested,
  suggestFixes,
  type TrainingSession,
} from "./training-week.ts";

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
  /** Heading of the steps that could follow once the proposal is applied. */
  nextStepsTitle: string;
  restDayBecomes: (day: string) => string;
  restDayReason: (day: string) => string;
  restDayAlready: (day: string) => string;
  /** A model move that was left out because it would put a session on a rest day. */
  leftOut: (title: string, day: string) => string;
  nextChip: (title: string, from: string, to: string) => string;
  fixReasons: Record<IssueKind, (day: string) => string>;
  apply: string;
  /** What the chat says after a proposal was applied; the summary names what changed. */
  applied: (summary: string) => string;
  /** A session's title in the page language (the model itself is shown the English titles). */
  sessionTitle: (session: TrainingSession) => string;
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
  /** The fixed rest days of the week, read on every message. */
  getRestDays?: () => readonly Day[];
  /** Called only after the athlete chose to apply a proposal; `restDays` is the full list after it. */
  onApply: (moves: Move[], restDays: Day[]) => void;
  chrome?: boolean;
}

const INSTALL = "install-model";
const APPLY = "apply-proposal";
const DISMISS = "dismiss-proposal";
const NEXT = "next-step:";

/**
 * Chat agent that moves training sessions with Gemini Nano. It only proposes: moves are applied
 * through a follow-up the athlete chooses ("AI-assisted, not AI-dependent": every move can still
 * be made by hand). Without the model it explains why, in the athlete's language.
 */
export function createTrainingAgent(
  { model, lang, strings: t, getWeek, getRestDays = () => [], onApply, chrome = isChromeBrowser() }: TrainingAgentOptions,
): ChatAgent {
  let pending: { moves: Move[]; restDays: Day[] } = { moves: [], restDays: [] };
  let nextSteps: Move[] = [];
  let lastInstruction = "";
  // The question that triggered the install offer, answered as soon as the model is installed.
  let waitingInstruction: string | null = null;
  let round = 0;

  const titleOf = (id: string) => {
    const session = getWeek().find((candidate) => candidate.id === id);
    return session ? t.sessionTitle(session) : undefined;
  };
  const moveLine = (move: Move, reason: string) => {
    const session = getWeek().find((candidate) => candidate.id === move.id);
    return session ? [`- ${t.movedFromTo(t.sessionTitle(session), t.days[session.day], t.days[move.toDay])}${reason ? ` — ${reason}` : ""}`] : [];
  };

  /**
   * A proposal as headed bullet lists: the step to apply now, what was left out, and, looking one step
   * ahead, what the week would still need afterwards. Only the first step has buttons; the next steps
   * come as chips once it is applied.
   */
  function proposal(moves: Move[], restDays: Day[], newRestDays: Day[], leftOut: string[]): ChatEvent {
    const week = getWeek();
    const fixes = suggestFixes(applyMoves(week, moves), restDays);
    const lines = [
      `# ${t.proposalTitle}`,
      ...newRestDays.map((day) => `- ${t.restDayBecomes(t.days[day])}`),
      ...moves.flatMap((move) => moveLine(move, move.reason)),
      ...leftOut.map((line) => `- ${line}`),
    ];
    if (fixes.length > 0) {
      lines.push(`# ${t.nextStepsTitle}`);
      const after = applyMoves(week, moves);
      for (const { move, resolves } of fixes) {
        const session = after.find((candidate) => candidate.id === move.id);
        if (session) {
          lines.push(`- ${t.movedFromTo(t.sessionTitle(session), t.days[session.day], t.days[move.toDay])} — ${t.fixReasons[resolves.kind](t.days[resolves.day])}`);
        }
      }
    }
    if (moves.length === 0 && newRestDays.length === 0) {
      return { type: "text", text: leftOut.length > 0 ? lines.join("\n") : t.proposalEmpty };
    }
    pending = { moves, restDays };
    const applyId = `apply-${round}`;
    const dismissId = `dismiss-${round}`;
    return {
      type: "text",
      text: lines.join("\n"),
      followUps: [
        { id: applyId, label: t.apply, prompt: APPLY, completes: dismissId },
        { id: dismissId, label: t.dismiss, prompt: DISMISS, completes: applyId },
      ],
    };
  }

  /** "I need a rest day on Wednesday": planned by the rules in code, so it needs no model. */
  function restDayProposal(days: Day[]): ChatEvent {
    let rest = [...getRestDays()];
    let current = getWeek();
    const moves: Move[] = [];
    const added: Day[] = [];
    for (const day of days) {
      if (rest.includes(day)) continue;
      const plan = planRestDay(current, rest, day);
      rest = plan.restDays;
      added.push(day);
      moves.push(...plan.moves.map((move) => ({ ...move, reason: t.restDayReason(t.days[day]) })));
      current = applyMoves(current, plan.moves);
    }
    if (added.length === 0) return { type: "text", text: days.map((day) => t.restDayAlready(t.days[day])).join(" ") };
    round++;
    return proposal(moves, rest, added, []);
  }

  function reply(result: AssistantReply): ChatEvent {
    round++;
    if (result.kind === "clarification") {
      pending = { moves: [], restDays: [] };
      return {
        type: "text",
        text: result.clarification.question,
        followUps: result.clarification.options.map((option) => ({
          id: `option-${round}-${option.id}`,
          label: titleOf(option.id) ?? option.label,
          prompt: `${lastInstruction} — I mean ${option.label} (session id "${option.id}").`,
        })),
      };
    }
    // A rest day asked for in other words: the rules plan it, whatever moves the model suggested.
    // Days that already are rest days are no news: a small model tends to echo them back, so they are not a request.
    const newRestDays = result.restDays.filter((day) => !getRestDays().includes(day));
    if (newRestDays.length > 0) return restDayProposal(newRestDays);
    const { allowed, rejected } = checkMoves(getRestDays(), result.moves);
    const leftOut = rejected.flatMap((move) => {
      const title = titleOf(move.id);
      return title ? [t.leftOut(title, t.days[move.toDay])] : [];
    });
    return proposal(allowed, [...getRestDays()], [], leftOut);
  }

  const text = (value: string, followUps?: ChatSuggestion[]): ChatEvent =>
    followUps ? { type: "text", text: value, followUps } : { type: "text", text: value };

  return {
    suggestions: () => Promise.resolve([]),
    async *run(message: string) {
      yield { type: "run-started" };

      if (message === APPLY) {
        const { moves, restDays } = pending;
        // Say what changed and where it went, in the page language, before the week itself changes.
        const before = getWeek();
        const summary = [
          ...restDays.filter((day) => !getRestDays().includes(day)).map((day) => t.restDayBecomes(t.days[day])),
          ...moves.flatMap((move) => {
            const session = before.find((candidate) => candidate.id === move.id);
            return session ? [t.movedFromTo(t.sessionTitle(session), t.days[session.day], t.days[move.toDay])] : [];
          }),
        ].join("; ");
        onApply(moves, restDays);
        pending = { moves: [], restDays: [] };
        // One step at a time: what the applied step leaves open comes as chips, each its own proposal.
        const after = applyMoves(before, moves);
        const fixes = suggestFixes(after, restDays);
        nextSteps = fixes.map((fix) => fix.move);
        const chips = fixes.flatMap((fix, index) => {
          const session = after.find((candidate) => candidate.id === fix.move.id);
          return session
            ? [{ id: `next-${++round}`, label: t.nextChip(t.sessionTitle(session), t.days[session.day], t.days[fix.move.toDay]), prompt: `${NEXT}${index}` }]
            : [];
        });
        yield text(t.applied(summary), chips.length > 0 ? chips : undefined);
      } else if (message === DISMISS) {
        pending = { moves: [], restDays: [] };
        yield text(t.dismissed);
      } else if (message.startsWith(NEXT)) {
        const move = nextSteps[Number(message.slice(NEXT.length))];
        if (!move) {
          yield text(t.proposalEmpty);
        } else {
          round++;
          yield proposal([move], [...pending.restDays.length ? pending.restDays : getRestDays()], [], []);
        }
      } else if (restDaysRequested(message).length > 0) {
        yield restDayProposal(restDaysRequested(message));
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
            waitingInstruction = message;
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
              const resume = waitingInstruction;
              waitingInstruction = null;
              if (resume) {
                lastInstruction = resume;
                yield reply(await proposeChange(model!, getWeek(), resume, undefined, getRestDays(), lang));
              } else {
                yield text(t.assistInstalled);
              }
            } catch {
              yield text(t.assistFailed);
            }
          }
        } else {
          if (!message.includes(" — I mean ")) lastInstruction = message;
          try {
            yield reply(await proposeChange(model!, getWeek(), message, undefined, getRestDays(), lang));
          } catch {
            yield text(t.assistFailed);
          }
        }
      }
      yield { type: "run-finished" };
    },
  };
}
