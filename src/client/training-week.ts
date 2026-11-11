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
