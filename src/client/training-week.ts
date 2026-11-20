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

/** What a run is run on: a trail (shown in the extractor's run green) or a road (grey). */
export type Surface = "trail" | "road";

/** Where a swim is swum: in open water or in a pool. It gives the icon of the session its waves. */
export type Water = "open" | "pool";

export interface TrainingSession {
  readonly id: string;
  readonly day: Day;
  readonly title: string;
  readonly discipline: Discipline;
  /** Only for runs. */
  readonly surface?: Surface;
  /** Only for swims. */
  readonly water?: Water;
  readonly minutes?: number;
}

/** A strength or mobility session of at most this many minutes is short and may share a day with a main session. */
export const SHORT_SESSION_MINUTES = 20;

/** A short strength or mobility session; every other session is a main session. */
export const isShort = (session: TrainingSession): boolean =>
  (session.discipline === "strength" || session.discipline === "flexibility") &&
  (session.minutes ?? Infinity) <= SHORT_SESSION_MINUTES;

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

const REST_WORDS = new Set(["rest", "rust", "rustdag", "sportrustdag", "sportrust", "repos", "ruhe", "ruhetag", "sportruhetag", "vrij"]);

/** How many words a day name may sit away from the rest word and still belong to it. */
const REST_WINDOW = 4;

/** Number of single-letter edits (insert, delete, change) between two words. */
function editDistance(a: string, b: string): number {
  let previous = Array.from({ length: b.length + 1 }, (_, index) => index);
  for (let i = 1; i <= a.length; i++) {
    const row = [i];
    for (let j = 1; j <= b.length; j++) {
      row[j] = Math.min(previous[j] + 1, row[j - 1] + 1, previous[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    }
    previous = row;
  }
  return previous[b.length];
}

/**
 * Whether a typed word is a day name, forgiving typos in the longer names ("sontagg" for "sonntag"):
 * up to two edits for names of seven letters or more, one for five and six, none for shorter ones.
 */
function sameWord(token: string, name: string): boolean {
  const allowed = name.length >= 7 ? 2 : name.length >= 5 ? 1 : 0;
  return Math.abs(token.length - name.length) <= allowed && editDistance(token, name) <= allowed;
}

/**
 * The days an instruction asks to be a rest day, in English, Dutch, French or German ("I need a rest day
 * on Wednesday", "ik wil woensdag rust"). A day counts when it stands within a few words of a rest word,
 * so "I travel Thursday and Friday and want Wednesday off as a rest day" gives only Wednesday.
 * "the rest of the week" is no rest day.
 */
export function restDaysRequested(instruction: string): Day[] {
  const tokens = instruction.toLowerCase().match(/\p{L}+/gu) ?? [];
  const dayOf = (token: string): Day | null => DAYS.find((day) => DAY_NAMES[day].some((name) => sameWord(token, name))) ?? null;
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

/** One main session and short ones next to it; more than this on a day is too much. */
const MAX_SESSIONS_PER_DAY = 3;

/** Every problem in the week. Only sessions on a rest day are a hard rule; the others are advice. */
export function weekIssues(week: readonly TrainingSession[], restDays: readonly Day[]): Issue[] {
  const issues: Issue[] = [];
  DAYS.forEach((day, index) => {
    const here = week.filter((session) => session.day === day);
    if (restDays.includes(day) && here.length > 0) {
      issues.push({ kind: "rest-day", day, ids: here.map((session) => session.id) });
    } else if (here.filter((session) => !isShort(session)).length > 1 || here.length > MAX_SESSIONS_PER_DAY) {
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
    // Fewest problems first, then a day that is still free, then the nearest day, and the later one when equal.
    const score = [problems, week.filter((other) => other.day === day).length, Math.abs(index - from), -index];
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

/**
 * Plan levers: how many sessions of each kind a week holds. Together with the rest days they are the top
 * level of a plan (spec 003): the same levers always give the same week.
 */
export interface PlanLevers {
  runs: number;
  swims: number;
  swimruns: number;
  /** Short strength sessions. */
  strength: number;
  /** Short mobility sessions. */
  mobility: number;
}

export const LEVER_LIMITS: Readonly<PlanLevers> = { runs: 4, swims: 3, swimruns: 2, strength: 3, mobility: 3 };

/** The levers of the example week: two runs, a swim, a swimrun brick, and two short strength and two short mobility sessions. */
export const DEFAULT_LEVERS: Readonly<PlanLevers> = { runs: 2, swims: 1, swimruns: 1, strength: 2, mobility: 2 };

/** What to do in a session, without a day: a session is a session template placed on a day. */
type SessionTemplate = Omit<TrainingSession, "day">;

/** The session templates a week is built from (prototype data), in the order the levers take them. */
const SESSION_TEMPLATES: Record<keyof PlanLevers, readonly SessionTemplate[]> = {
  swimruns: [
    { id: "swimrun-1", title: "Swimrun brick, 2 h", discipline: "swimrun", minutes: 120 },
    { id: "swimrun-2", title: "Swimrun, 90 min", discipline: "swimrun", minutes: 90 },
  ],
  runs: [
    { id: "run-1", title: "Trail run, 75 min Z2", discipline: "run", surface: "trail", minutes: 75 },
    { id: "run-2", title: "Run intervals, 6×400 m", discipline: "run", surface: "road", minutes: 50 },
    { id: "run-3", title: "Road run, 45 min Z2", discipline: "run", surface: "road", minutes: 45 },
    { id: "run-4", title: "Trail run, 60 min Z2", discipline: "run", surface: "trail", minutes: 60 },
  ],
  swims: [
    { id: "swim-1", title: "Open-water swim, 2 km", discipline: "swim", water: "open", minutes: 50 },
    { id: "swim-2", title: "Pool swim, 1.5 km", discipline: "swim", water: "pool", minutes: 40 },
    { id: "swim-3", title: "Open-water swim, 3 km", discipline: "swim", water: "open", minutes: 75 },
  ],
  strength: [
    { id: "strength-1", title: "Strength: legs, 15 min", discipline: "strength", minutes: 15 },
    { id: "strength-2", title: "Strength: core, 15 min", discipline: "strength", minutes: 15 },
    { id: "strength-3", title: "Strength: upper body, 15 min", discipline: "strength", minutes: 15 },
  ],
  mobility: [
    { id: "mobility-1", title: "Mobility: dynamic, 15 min", discipline: "flexibility", minutes: 15 },
    { id: "mobility-2", title: "Mobility: static, 15 min", discipline: "flexibility", minutes: 15 },
    { id: "mobility-3", title: "Mobility: hips and ankles, 15 min", discipline: "flexibility", minutes: 15 },
  ],
};

/** The ids of every session template, for translating their titles. */
export const SESSION_TEMPLATE_IDS: readonly string[] = Object.values(SESSION_TEMPLATES).flatMap((templates) => templates.map((template) => template.id));

/** Levers kept within their limits and whole numbers. */
export function clampLevers(levers: PlanLevers): PlanLevers {
  const clamp = (value: number, max: number) => Math.min(max, Math.max(0, Math.floor(Number.isFinite(value) ? value : 0)));
  return {
    runs: clamp(levers.runs, LEVER_LIMITS.runs),
    swims: clamp(levers.swims, LEVER_LIMITS.swims),
    swimruns: clamp(levers.swimruns, LEVER_LIMITS.swimruns),
    strength: clamp(levers.strength, LEVER_LIMITS.strength),
    mobility: clamp(levers.mobility, LEVER_LIMITS.mobility),
  };
}

/**
 * Builds a week from levers by fixed rules, so the same levers and rest days always give the same week.
 * Main sessions (swimrun, runs, swims, in that order) go to the day with the fewest problems, then the day
 * with the fewest main sessions, then the day farthest from the other main sessions; the swimrun prefers the
 * end of the week. Short sessions then go to the day with the fewest problems and the fewest sessions.
 * Nothing lands on a rest day. A session that finds no day is reported by id.
 */
export function generateWeek(
  levers: PlanLevers,
  restDays: readonly Day[] = [],
): { week: TrainingSession[]; unplaced: string[] } {
  const wanted = clampLevers(levers);
  const days = DAYS.filter((day) => !restDays.includes(day));
  const placed: TrainingSession[] = [];
  const unplaced: string[] = [];
  const take = (kind: keyof PlanLevers) => SESSION_TEMPLATES[kind].slice(0, wanted[kind]);
  const before = (a: number[], b: number[]) => {
    for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return a[i] < b[i];
    return false;
  };

  const place = (template: SessionTemplate, kind: keyof PlanLevers) => {
    let best: Day | null = null;
    let bestScore: number[] = [];
    for (const day of days) {
      const candidate: TrainingSession = { ...template, day };
      const problems = weekIssues([...placed, candidate], restDays).length;
      const here = placed.filter((session) => session.day === day);
      const mains = placed.filter((session) => !isShort(session));
      const index = DAYS.indexOf(day);
      const apart = mains.length === 0
        ? 0
        : -Math.min(...mains.map((session) => Math.abs(DAYS.indexOf(session.day) - index)));
      const score = isShort(candidate)
        ? [problems, here.length, index]
        : [problems, here.filter((session) => !isShort(session)).length, apart, kind === "swimruns" ? -index : index];
      if (best === null || before(score, bestScore)) {
        best = day;
        bestScore = score;
      }
    }
    if (best === null) unplaced.push(template.id);
    else placed.push({ ...template, day: best });
  };

  for (const kind of ["swimruns", "runs", "swims", "strength", "mobility"] as const) {
    for (const template of take(kind)) place(template, kind);
  }
  return { week: placed, unplaced };
}

/** The example week of the prototype: what the default levers give. */
export const PROTOTYPE_WEEK: readonly TrainingSession[] = generateWeek(DEFAULT_LEVERS).week;
