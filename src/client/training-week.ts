/**
 * Domain model for the prototype training week.
 *
 * A week is an ordered list of planned sessions, one per id. Rearranging
 * produces a new week; the original is never mutated (the same rule as for
 * GPX data). An AI proposal is evidence of what a rearrangement could be;
 * the athlete's confirmation is the label.
 */

export const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"] as const;
export type Day = typeof DAYS[number];

export const isDay = (value: unknown): value is Day =>
  DAYS.some((day) => day === value);

export type Discipline =
  | "swim"
  | "run"
  | "swimrun"
  | "strength"
  | "flexibility";

export interface TrainingSession {
  readonly id: string;
  readonly day: Day;
  readonly title: string;
  readonly discipline: Discipline;
}

/**
 * The disciplines an instruction talks about, from stems in the four site languages
 * ("run", "hardlopen", "laufen", "courir", ...). Empty when it names none.
 */
export function mentionedDisciplines(instruction: string): ReadonlySet<Discipline> {
  const text = instruction.toLowerCase();
  const stems: [Discipline, RegExp][] = [
    ["run", /\b(run|runs|running|jog|trail|hardlo|rennen|renn|laufen|lauf|courir|course|cours)/],
    ["swim", /\b(swim|zwem|schwimm|nager|nage|natation)/],
    ["strength", /\b(strength|kracht|kraft|force|muscu)/],
    ["flexibility", /\b(flex|mobility|stretch|rek|beweglich|souplesse|mobilit)/],
  ];
  return new Set(stems.filter(([, pattern]) => pattern.test(text)).map(([discipline]) => discipline));
}

/**
 * Whether a session fits what the instruction talks about. A swimrun session counts as both a
 * run and a swim; with no discipline named, every session fits.
 */
export function fitsInstruction(session: TrainingSession, mentioned: ReadonlySet<Discipline>): boolean {
  if (mentioned.size === 0) return true;
  if (mentioned.has(session.discipline)) return true;
  return session.discipline === "swimrun" && (mentioned.has("run") || mentioned.has("swim"));
}

/** A proposal to move one existing session to another day. */
export interface Move {
  readonly id: string;
  readonly toDay: Day;
  readonly reason: string;
}

/** The hardcoded prototype week: the four swimrun capacities across six sessions. */
export const PROTOTYPE_WEEK: readonly TrainingSession[] = [
  {
    id: "strength",
    day: "Mon",
    title: "Strength: legs & core, 45 min",
    discipline: "strength",
  },
  {
    id: "ow-swim",
    day: "Tue",
    title: "Open-water swim, 2 km",
    discipline: "swim",
  },
  {
    id: "flex",
    day: "Wed",
    title: "Flexibility: static + dynamic, 30 min",
    discipline: "flexibility",
  },
  { id: "trail", day: "Thu", title: "Trail run, 75 min Z2", discipline: "run" },
  {
    id: "intervals",
    day: "Sat",
    title: "Run intervals, 6×400 m",
    discipline: "run",
  },
  {
    id: "brick",
    day: "Sun",
    title: "Swimrun brick, 2 h",
    discipline: "swimrun",
  },
];

/** Returns a new week with the moves applied; the input week is not mutated. */
export function applyMoves(
  week: readonly TrainingSession[],
  moves: readonly Move[],
): TrainingSession[] {
  const target = new Map(moves.map((move) => [move.id, move.toDay]));
  return week.map((session) => {
    const toDay = target.get(session.id);
    return toDay === undefined ? session : { ...session, day: toDay };
  });
}

/** The sessions of `week` whose day differs from the same session in `baseline`. */
export function changedSessions(
  baseline: readonly TrainingSession[],
  week: readonly TrainingSession[],
): { session: TrainingSession; fromDay: Day }[] {
  const before = new Map(baseline.map((session) => [session.id, session.day]));
  return week.flatMap((session) => {
    const fromDay = before.get(session.id);
    return fromDay !== undefined && fromDay !== session.day
      ? [{ session, fromDay }]
      : [];
  });
}

/**
 * Parses a model response into moves. Throws on malformed JSON or a missing
 * `moves` array; silently drops moves that name an unknown session or an
 * invalid day, because a proposal may only rearrange what exists.
 */
export function parseProposal(
  json: string,
  week: readonly TrainingSession[],
): Move[] {
  const parsed: unknown = JSON.parse(json);
  const moves = (parsed as { moves?: unknown })?.moves;
  if (!Array.isArray(moves)) throw new Error("Proposal has no moves array");
  const known = new Set(week.map((session) => session.id));
  return moves.flatMap((move: unknown) => {
    const { id, toDay, reason } = (move ?? {}) as Record<string, unknown>;
    if (typeof id !== "string" || !known.has(id) || !isDay(toDay)) return [];
    return [{ id, toDay, reason: typeof reason === "string" ? reason : "" }];
  });
}

/**
 * Rest days. A rest day is a day of the week on which no session may be planned: a fixed part of the
 * plan levers (spec 003), not a gap that happens to be empty. Rules are checked here, in plain code, so
 * that a language model never decides what is allowed.
 */

const DAY_NAMES: Record<Day, readonly string[]> = {
  Mon: ["monday", "mon", "maandag", "lundi", "montag"],
  Tue: ["tuesday", "tue", "tues", "dinsdag", "mardi", "dienstag"],
  Wed: ["wednesday", "wed", "woensdag", "mercredi", "mittwoch"],
  Thu: ["thursday", "thu", "thur", "thurs", "donderdag", "jeudi", "donnerstag"],
  Fri: ["friday", "fri", "vrijdag", "vendredi", "freitag"],
  Sat: ["saturday", "sat", "zaterdag", "samedi", "samstag"],
  Sun: ["sunday", "sun", "zondag", "dimanche", "sonntag"],
};

const REST_WORDS = new Set(["rest", "rust", "rustdag", "repos", "ruhe", "ruhetag", "vrij"]);

/** How many words a day name may sit away from the rest word and still belong to it. */
const REST_WINDOW = 4;

/**
 * The days an instruction asks to be a rest day, in English, Dutch, French or German ("I need a rest day
 * on Wednesday", "ik wil woensdag rust"). A day counts when it stands within a few words of a rest word,
 * so "I travel Thursday and Friday and want Wednesday off as a rest day" gives only Wednesday.
 * "the rest of the week" is no rest day.
 */
export function restDaysRequested(instruction: string): Day[] {
  const tokens = instruction.toLowerCase().match(/\p{L}+/gu) ?? [];
  const dayOf = (token: string): Day | null => DAYS.find((day) => DAY_NAMES[day].includes(token)) ?? null;
  const isRest = (token: string, index: number) =>
    REST_WORDS.has(token) && !(token === "rest" && tokens[index + 1] === "of") ||
    (token === "off" && (tokens[index - 1] === "day" || tokens[index + 1] === "day"));
  const found = new Set<Day>();
  tokens.forEach((token, index) => {
    if (!isRest(token, index)) return;
    for (let near = Math.max(0, index - REST_WINDOW); near <= Math.min(tokens.length - 1, index + REST_WINDOW); near++) {
      const day = dayOf(tokens[near]);
      if (day) found.add(day);
    }
  });
  return DAYS.filter((day) => found.has(day));
}

export type IssueKind = "rest-day" | "clash" | "back-to-back-runs";

/** A problem in a week: sessions on a rest day, two sessions on one day, or runs on consecutive days. */
export interface Issue {
  kind: IssueKind;
  day: Day;
  /** The sessions involved, earliest day first. */
  ids: string[];
}

const isRun = (session: TrainingSession) => session.discipline === "run";

/** Every problem in the week. Only sessions on a rest day are a hard rule; the others are advice. */
export function weekIssues(week: readonly TrainingSession[], restDays: readonly Day[]): Issue[] {
  const issues: Issue[] = [];
  DAYS.forEach((day, index) => {
    const here = week.filter((session) => session.day === day);
    if (restDays.includes(day) && here.length > 0) {
      issues.push({ kind: "rest-day", day, ids: here.map((session) => session.id) });
    } else if (here.length > 1) {
      issues.push({ kind: "clash", day, ids: here.map((session) => session.id) });
    }
    const next = DAYS[index + 1];
    const runsNext = next ? week.filter((session) => session.day === next && isRun(session)) : [];
    const runsHere = here.filter(isRun);
    if (runsHere.length > 0 && runsNext.length > 0) {
      issues.push({ kind: "back-to-back-runs", day: next, ids: [...runsHere, ...runsNext].map((session) => session.id) });
    }
  });
  return issues;
}

/** Splits moves into those that respect the rest days and those that would put a session on one. */
export function checkMoves(
  restDays: readonly Day[],
  moves: readonly Move[],
): { allowed: Move[]; rejected: Move[] } {
  const allowed: Move[] = [];
  const rejected: Move[] = [];
  for (const move of moves) (restDays.includes(move.toDay) ? rejected : allowed).push(move);
  return { allowed, rejected };
}

/**
 * The day that suits a session best: never a rest day, and the one with the fewest problems in the
 * resulting week; among equals the nearest day, and the later one when two are equally near. Null when
 * every other day is a rest day.
 */
function bestDay(week: readonly TrainingSession[], restDays: readonly Day[], id: string): Day | null {
  const session = week.find((candidate) => candidate.id === id);
  if (!session) return null;
  const from = DAYS.indexOf(session.day);
  const before = (a: number[], b: number[]) => {
    for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return a[i] < b[i];
    return false;
  };
  let best: Day | null = null;
  let bestScore: number[] = [];
  DAYS.forEach((day, index) => {
    if (day === session.day || restDays.includes(day)) return;
    const problems = weekIssues(applyMoves(week, [{ id, toDay: day, reason: "" }]), restDays).length;
    const score = [problems, Math.abs(index - from), -index];
    if (best === null || before(score, bestScore)) {
      best = day;
      bestScore = score;
    }
  });
  return best;
}

/**
 * The first step for "I need a rest day on this day": each session on that day goes to the best other
 * day, one at a time, and nothing else in the week moves. What the move may leave behind is advice for
 * a next step (see `suggestFixes`), not part of this one.
 */
export function planRestDay(
  week: readonly TrainingSession[],
  restDays: readonly Day[],
  day: Day,
): { restDays: Day[]; moves: Move[] } {
  const rest = DAYS.filter((candidate) => candidate === day || restDays.includes(candidate));
  const moves: Move[] = [];
  let current = week;
  for (const session of week.filter((candidate) => candidate.day === day)) {
    const toDay = bestDay(current, rest, session.id);
    if (!toDay) continue;
    const move = { id: session.id, toDay, reason: "" };
    moves.push(move);
    current = applyMoves(current, [move]);
  }
  return { restDays: rest, moves };
}

/** A possible next step: one move that lessens a problem, and the problem it answers. */
export interface Fix {
  move: Move;
  resolves: Issue;
}

/**
 * Looks one step ahead: for the problems in the week, at most `limit` single moves that each make the
 * week better. The later session of a problem is the one to move, and nothing is chained: the athlete
 * applies one step and then sees what the next one is.
 */
export function suggestFixes(week: readonly TrainingSession[], restDays: readonly Day[], limit = 2): Fix[] {
  const fixes: Fix[] = [];
  let current = week;
  for (const issue of weekIssues(week, restDays)) {
    if (fixes.length >= limit) break;
    const id = issue.ids.at(-1)!;
    const toDay = bestDay(current, restDays, id);
    if (!toDay) continue;
    const move = { id, toDay, reason: "" };
    const after = applyMoves(current, [move]);
    if (weekIssues(after, restDays).length >= weekIssues(current, restDays).length) continue;
    fixes.push({ move, resolves: issue });
    current = after;
  }
  return fixes;
}
