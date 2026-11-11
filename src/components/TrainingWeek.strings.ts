import type { Lang } from "../client/language.ts";
import type { Day, Discipline, IssueKind, PlanLevers, Surface } from "../client/training-week.ts";
import { de } from "./TrainingWeek.strings.de.ts";
import { en } from "./TrainingWeek.strings.en.ts";
import { fr } from "./TrainingWeek.strings.fr.ts";
import { nl } from "./TrainingWeek.strings.nl.ts";

/** Every text of the training page. The page owns its translations: one file per language next to this one. */
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
  restDayBlocked: (day: string) => string;
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

export const STRINGS: Record<Lang, Strings> = { en, nl, fr, de };
