import type { Lang } from "../client/language.ts";
import type { Day, Discipline, IssueKind, PlanLevers, Surface } from "../client/training-week.ts";
import { bundle, trainingT } from "../client/i18n.ts";

/** Every text of the training page. The texts are ICU messages in `src/data/training.<language>.json` (ADR-0017); the functions below fill in their variables. */
export interface Strings {
  prototypeNote: string;
  weekTitle: string;
  dayLabel: string;
  dragHint: string;
  assistAbsent: string;
  assistUnavailable: string;
  assistDownloadable: string;
  assistEnable: string;
  assistInstalled: string;
  chatTitle: string;
  applied: (summary: string) => string;
  sessionTitles: Record<string, string>;
  revert: string;
  resetAll: string;
  resetDone: string;
  undoReset: string;
  surfaces: Record<Surface, string>;
  leversTitle: string;
  leversHint: string;
  leverLabels: Record<keyof PlanLevers, string>;
  generate: string;
  generated: string;
  notPlaced: (count: number) => string;
  undoGenerate: string;
  dismissed: string;
  assistDownloading: string;
  instructionPlaceholder: string;
  proposalTitle: string;
  proposalEmpty: string;
  apply: string;
  dismiss: string;
  assistFailed: string;
  changesTitle: string;
  noChanges: string;
  movedFromTo: (title: string, from: string, to: string) => string;
  restDay: string;
  restDaysLabel: string;
  restDaysNone: string;
  /** Said when a session is moved onto a sports rest day: the move is allowed, and this warns. */
  restDayWarning: (day: string) => string;
  /** On a rest day card that holds a session. */
  restDayWithSession: string;
  nextStepsTitle: string;
  restDayBecomes: (day: string) => string;
  restDayReason: (day: string) => string;
  restDayAlready: (day: string) => string;
  leftOut: (title: string, day: string) => string;
  nextChip: (title: string, from: string, to: string) => string;
  /** Default chips of the chat: make a day a sports rest day, and fix what the week still needs. */
  restDayChip: (day: string) => string;
  fixChip: string;
  fixReasons: Record<IssueKind, (day: string) => string>;
  confirm: string;
  confirmed: string;
  days: Record<Day, string>;
  disciplines: Record<Discipline, string>;
}

type Plain = Omit<Strings, "applied" | "notPlaced" | "movedFromTo" | "restDayWarning" | "restDayBecomes" | "restDayReason" | "restDayAlready" | "leftOut" | "nextChip" | "restDayChip" | "fixReasons"> & { fixReasons: Record<IssueKind, string> };

/** The texts of one language: what has no variable comes as it is, the rest are messages that get their variables here. */
function strings(lang: Lang): Strings {
  const t = trainingT(lang);
  const { fixReasons, ...plain } = bundle<Plain>(lang, "training");
  return {
    ...plain,
    applied: (summary) => t("applied", { summary }),
    notPlaced: (count) => t("notPlaced", { count }),
    movedFromTo: (title, from, to) => t("movedFromTo", { title, from, to }),
    restDayWarning: (day) => t("restDayWarning", { day }),
    restDayBecomes: (day) => t("restDayBecomes", { day }),
    restDayReason: (day) => t("restDayReason", { day }),
    restDayAlready: (day) => t("restDayAlready", { day }),
    leftOut: (title, day) => t("leftOut", { title, day }),
    nextChip: (title, from, to) => t("nextChip", { title, from, to }),
    restDayChip: (day) => t("restDayChip", { day }),
    fixReasons: Object.fromEntries(Object.keys(fixReasons).map((kind) => [kind, (day: string) => t(`fixReasons.${kind}`, { day })])) as Strings["fixReasons"],
  };
}

export const STRINGS: Record<Lang, Strings> = { en: strings("en"), nl: strings("nl"), fr: strings("fr"), de: strings("de") };
