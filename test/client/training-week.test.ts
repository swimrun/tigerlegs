import { expect, it } from "vitest";
import {
  applyMoves,
  CATALOG_IDS,
  changedSessions,
  checkMoves,
  clampLevers,
  DAYS,
  DEFAULT_LEVERS,
  generateWeek,
  isShort,
  LEVER_LIMITS,
  type Day,
  fitsInstruction,
  isDay,
  mentionedDisciplines,
  parseProposal,
  planRestDay,
  PROTOTYPE_WEEK,
  restDaysRequested,
  suggestFixes,
  type TrainingSession,
  weekIssues,
} from "../../src/client/training-week.ts";

const WEEK: TrainingSession[] = [
  { id: "trail", day: "Thu", title: "Trail run", discipline: "run" },
  { id: "strength", day: "Fri", title: "Strength", discipline: "strength" },
];

it("isDay - accepts days and rejects everything else", () => {
  expect(isDay("Mon")).toEqual(true);
  expect(isDay("Monday")).toEqual(false);
  expect(isDay(null)).toEqual(false);
});

it("applyMoves - moves named sessions and keeps the rest", () => {
  const result = applyMoves(WEEK, [{
    id: "trail",
    toDay: "Mon",
    reason: "travel",
  }]);
  expect(result.map((s) => s.day)).toEqual(["Mon", "Fri"]);
});

it("applyMoves - does not mutate the input week", () => {
  const input = structuredClone(WEEK);
  applyMoves(input, [{ id: "trail", toDay: "Sun", reason: "" }]);
  expect(input).toEqual(WEEK);
});

it("applyMoves - ignores moves for unknown sessions", () => {
  const result = applyMoves(WEEK, [{ id: "ghost", toDay: "Mon", reason: "" }]);
  expect(result).toEqual(WEEK);
});

it("changedSessions - lists only sessions whose day changed, with the old day", () => {
  const next = applyMoves(WEEK, [{ id: "strength", toDay: "Wed", reason: "" }]);
  const changes = changedSessions(WEEK, next);
  expect(changes.length).toEqual(1);
  expect(changes[0].session.id).toEqual("strength");
  expect(changes[0].fromDay).toEqual("Fri" as Day);
});

it("parseProposal - keeps valid moves and drops unknown ids and invalid days", () => {
  const json = JSON.stringify({
    moves: [
      { id: "trail", toDay: "Mon", reason: "travel" },
      { id: "ghost", toDay: "Tue", reason: "hallucinated session" },
      { id: "strength", toDay: "Someday", reason: "invalid day" },
      { id: "strength", toDay: "Wed" },
    ],
  });
  expect(parseProposal(json, WEEK)).toEqual([
    { id: "trail", toDay: "Mon", reason: "travel" },
    { id: "strength", toDay: "Wed", reason: "" },
  ]);
});

it("parseProposal - throws on malformed JSON and on a missing moves array", () => {
  expect(() => parseProposal("not json", WEEK)).toThrow();
  expect(() => parseProposal(JSON.stringify({ sessions: [] }), WEEK)).toThrow();
});

it("PROTOTYPE_WEEK - has unique ids and covers the four swimrun capacities", () => {
  const ids = PROTOTYPE_WEEK.map((session) => session.id);
  expect(new Set(ids).size).toEqual(ids.length);
  const disciplines = new Set(
    PROTOTYPE_WEEK.map((session) => session.discipline),
  );
  for (const needed of ["swim", "run", "strength", "flexibility"]) {
    expect(disciplines.has(needed as TrainingSession["discipline"]), `missing ${needed}`).toEqual(true);
  }
});

it("mentionedDisciplines - finds the discipline in the four site languages", () => {
  expect([...mentionedDisciplines("I want to run every other day")]).toEqual(["run"]);
  expect([...mentionedDisciplines("ik wil vaker zwemmen")]).toEqual(["swim"]);
  expect([...mentionedDisciplines("Ich möchte weniger laufen")]).toEqual(["run"]);
  expect([...mentionedDisciplines("je veux nager plus")]).toEqual(["swim"]);
  expect([...mentionedDisciplines("I am travelling Thursday")]).toEqual([]);
});

it("fitsInstruction - a swimrun session fits both a run and a swim instruction", () => {
  const brick = PROTOTYPE_WEEK.find((session) => session.id === "swimrun-1")!;
  const swim = PROTOTYPE_WEEK.find((session) => session.id === "swim-1")!;
  expect(fitsInstruction(brick, new Set(["run"]))).toEqual(true);
  expect(fitsInstruction(swim, new Set(["run"]))).toEqual(false);
  expect(fitsInstruction(swim, new Set())).toEqual(true);
});

it("restDaysRequested reads rest days in English, Dutch, French and German", () => {
  expect(restDaysRequested("I need a rest day on Wednesday")).toEqual(["Wed"]);
  expect(restDaysRequested("ik wil woensdag een rustdag")).toEqual(["Wed"]);
  expect(restDaysRequested("je voudrais un jour de repos le vendredi")).toEqual(["Fri"]);
  expect(restDaysRequested("Ich brauche am Sonntag einen Ruhetag")).toEqual(["Sun"]);
  expect(restDaysRequested("Make Wednesday a day off please")).toEqual(["Wed"]);
});

it("restDaysRequested ignores days that are not next to a rest word", () => {
  expect(restDaysRequested("I am travelling Thursday and Friday, so I need a rest day on Wednesday and then move things")).toEqual(["Wed"]);
  expect(restDaysRequested("I am travelling Thursday and Friday")).toEqual([]);
  expect(restDaysRequested("Run the rest of the week on Tuesday")).toEqual([]);
});

it("the prototype week has no problems, and a session on a rest day is one", () => {
  expect(weekIssues(PROTOTYPE_WEEK, [])).toEqual([]);
  expect(weekIssues(PROTOTYPE_WEEK, ["Wed"]).map((issue) => issue.kind)).toEqual(["rest-day"]);
});

it("two main sessions on a day, and runs on consecutive days, are problems", () => {
  const clash = applyMoves(PROTOTYPE_WEEK, [{ id: "swim-1", toDay: "Mon", reason: "" }]);
  expect(weekIssues(clash, []).map((issue) => issue.kind)).toEqual(["clash"]);
  const runs = applyMoves(PROTOTYPE_WEEK, [
    { id: "swim-1", toDay: "Thu", reason: "" },
    { id: "run-2", toDay: "Tue", reason: "" },
  ]);
  expect(weekIssues(runs, []).map((issue) => issue.kind)).toEqual(["back-to-back-runs"]);
});

it("a short session next to a main session is no problem", () => {
  const shared = applyMoves(PROTOTYPE_WEEK, [{ id: "strength-1", toDay: "Thu", reason: "" }]);
  expect(weekIssues(shared, [])).toEqual([]);
});

it("checkMoves keeps moves off rest days", () => {
  const moves = [{ id: "brick", toDay: "Wed", reason: "" }, { id: "trail", toDay: "Fri", reason: "" }] as const;
  const { allowed, rejected } = checkMoves(["Wed"], moves);
  expect(allowed.map((move) => move.id)).toEqual(["trail"]);
  expect(rejected.map((move) => move.id)).toEqual(["brick"]);
});

it("planRestDay moves only the sessions of that day, to a day that still has room, and nothing else", () => {
  const plan = planRestDay(PROTOTYPE_WEEK, [], "Wed");
  expect(plan.restDays).toEqual(["Wed"]);
  expect(plan.moves.map(({ id, toDay }) => [id, toDay])).toEqual([["strength-1", "Thu"]]);
  const after = applyMoves(PROTOTYPE_WEEK, plan.moves);
  expect(weekIssues(after, plan.restDays)).toEqual([]);
});

it("planRestDay never puts a session on another rest day", () => {
  const plan = planRestDay(PROTOTYPE_WEEK, ["Thu"], "Wed");
  expect(plan.restDays).toEqual(["Wed", "Thu"]);
  expect(plan.moves.length > 0 && plan.moves.every((move) => !plan.restDays.includes(move.toDay))).toBeTruthy();
});

it("planRestDay on an empty day changes nothing but the rest days", () => {
  const week = applyMoves(PROTOTYPE_WEEK, [{ id: "strength-1", toDay: "Mon", reason: "" }]);
  const plan = planRestDay(week, [], "Wed");
  expect(plan.moves).toEqual([]);
  expect(plan.restDays).toEqual(["Wed"]);
});

it("suggestFixes looks one step ahead and moves the later session of a problem", () => {
  const runs: TrainingSession[] = [
    { id: "run-1", day: "Mon", title: "Run 1", discipline: "run" },
    { id: "run-2", day: "Tue", title: "Run 2", discipline: "run" },
    { id: "swim-1", day: "Thu", title: "Swim", discipline: "swim" },
  ];
  const [fix, ...rest] = suggestFixes(runs, []);
  expect(fix.resolves.kind).toEqual("back-to-back-runs");
  expect([fix.move.id, fix.move.toDay]).toEqual(["run-2", "Wed"]);
  expect(rest).toEqual([]);
  expect(weekIssues(applyMoves(runs, [fix.move]), [])).toEqual([]);
});

it("suggestFixes has nothing to suggest for a week without problems", () => {
  expect(suggestFixes(PROTOTYPE_WEEK, [])).toEqual([]);
});

it("restDaysRequested forgives typos in the longer day names", () => {
  expect(restDaysRequested("Ich will der sontagg als Ruhe.")).toEqual(["Sun"]);
  expect(restDaysRequested("ik wil woensdga rust")).toEqual(["Wed"]);
  expect(restDaysRequested("a rest day on wednsday")).toEqual(["Wed"]);
});

it("restDaysRequested does not take other words for a day", () => {
  expect(restDaysRequested("I want to rest, sunny weather, a monkey and the sandwich")).toEqual([]);
});

it("the default levers give the example week: two short strength and two short mobility sessions", () => {
  expect(generateWeek(DEFAULT_LEVERS).week).toEqual([...PROTOTYPE_WEEK]);
  const short = PROTOTYPE_WEEK.filter(isShort);
  expect(short.filter((session) => session.discipline === "strength").length).toEqual(2);
  expect(short.filter((session) => session.discipline === "flexibility").length).toEqual(2);
  expect(short.every((session) => session.minutes === 15)).toBeTruthy();
  expect(weekIssues(PROTOTYPE_WEEK, [])).toEqual([]);
});

it("the example week has a trail run and a road run", () => {
  const surfaces = PROTOTYPE_WEEK.filter((session) => session.discipline === "run").map((session) => session.surface);
  expect(surfaces).toEqual(["trail", "road"]);
});

it("generateWeek gives the same week for the same levers and rest days", () => {
  const levers = { runs: 3, swims: 2, swimruns: 1, strength: 3, mobility: 2 };
  expect(generateWeek(levers, ["Wed"])).toEqual(generateWeek(levers, ["Wed"]));
});

it("generateWeek puts nothing on a rest day and has as many sessions as the levers ask for", () => {
  const levers = { runs: 3, swims: 2, swimruns: 1, strength: 3, mobility: 2 };
  const { week, unplaced } = generateWeek(levers, ["Wed", "Fri"]);
  expect(unplaced).toEqual([]);
  expect(week.length).toEqual(3 + 2 + 1 + 3 + 2);
  expect(week.every((session) => session.day !== "Wed" && session.day !== "Fri")).toBeTruthy();
  expect(weekIssues(week, ["Wed", "Fri"]).every((issue) => issue.kind !== "rest-day")).toBeTruthy();
});

it("generateWeek with every day a rest day places nothing and reports it", () => {
  const { week, unplaced } = generateWeek(DEFAULT_LEVERS, [...DAYS]);
  expect(week).toEqual([]);
  expect(unplaced.length).toEqual(8);
});

it("generateWeek keeps levers within their limits", () => {
  const { week } = generateWeek({ runs: 99, swims: -3, swimruns: 1.7, strength: Number.NaN, mobility: 3 });
  expect(week.filter((session) => session.discipline === "run").length).toEqual(LEVER_LIMITS.runs);
  expect(week.filter((session) => session.discipline === "swim").length).toEqual(0);
  expect(week.filter((session) => session.discipline === "swimrun").length).toEqual(1);
  expect(week.filter((session) => session.discipline === "strength").length).toEqual(0);
  expect(clampLevers({ runs: 9, swims: 9, swimruns: 9, strength: 9, mobility: 9 })).toEqual(LEVER_LIMITS);
});

it("every session a lever can produce has a unique id", () => {
  expect(new Set(CATALOG_IDS).size).toEqual(CATALOG_IDS.length);
});

it("restDaysRequested knows the sports rest day in Dutch and German", () => {
  expect(restDaysRequested("woensdag sportrustdag graag")).toEqual(["Wed"]);
  expect(restDaysRequested("Am Sonntag Sportruhetag bitte")).toEqual(["Sun"]);
});
