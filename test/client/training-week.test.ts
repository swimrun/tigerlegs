import { assert, assertEquals, assertThrows } from "@std/assert";
import {
  applyMoves,
  changedSessions,
  checkMoves,
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

Deno.test("isDay - accepts days and rejects everything else", () => {
  assertEquals(isDay("Mon"), true);
  assertEquals(isDay("Monday"), false);
  assertEquals(isDay(null), false);
});

Deno.test("applyMoves - moves named sessions and keeps the rest", () => {
  const result = applyMoves(WEEK, [{
    id: "trail",
    toDay: "Mon",
    reason: "travel",
  }]);
  assertEquals(result.map((s) => s.day), ["Mon", "Fri"]);
});

Deno.test("applyMoves - does not mutate the input week", () => {
  const input = structuredClone(WEEK);
  applyMoves(input, [{ id: "trail", toDay: "Sun", reason: "" }]);
  assertEquals(input, WEEK);
});

Deno.test("applyMoves - ignores moves for unknown sessions", () => {
  const result = applyMoves(WEEK, [{ id: "ghost", toDay: "Mon", reason: "" }]);
  assertEquals(result, WEEK);
});

Deno.test("changedSessions - lists only sessions whose day changed, with the old day", () => {
  const next = applyMoves(WEEK, [{ id: "strength", toDay: "Wed", reason: "" }]);
  const changes = changedSessions(WEEK, next);
  assertEquals(changes.length, 1);
  assertEquals(changes[0].session.id, "strength");
  assertEquals(changes[0].fromDay, "Fri" as Day);
});

Deno.test("parseProposal - keeps valid moves and drops unknown ids and invalid days", () => {
  const json = JSON.stringify({
    moves: [
      { id: "trail", toDay: "Mon", reason: "travel" },
      { id: "ghost", toDay: "Tue", reason: "hallucinated session" },
      { id: "strength", toDay: "Someday", reason: "invalid day" },
      { id: "strength", toDay: "Wed" },
    ],
  });
  assertEquals(parseProposal(json, WEEK), [
    { id: "trail", toDay: "Mon", reason: "travel" },
    { id: "strength", toDay: "Wed", reason: "" },
  ]);
});

Deno.test("parseProposal - throws on malformed JSON and on a missing moves array", () => {
  assertThrows(() => parseProposal("not json", WEEK));
  assertThrows(() => parseProposal(JSON.stringify({ sessions: [] }), WEEK));
});

Deno.test("PROTOTYPE_WEEK - has unique ids and covers the four swimrun capacities", () => {
  const ids = PROTOTYPE_WEEK.map((session) => session.id);
  assertEquals(new Set(ids).size, ids.length);
  const disciplines = new Set(
    PROTOTYPE_WEEK.map((session) => session.discipline),
  );
  for (const needed of ["swim", "run", "strength", "flexibility"]) {
    assertEquals(
      disciplines.has(needed as TrainingSession["discipline"]),
      true,
      `missing ${needed}`,
    );
  }
});

Deno.test("mentionedDisciplines - finds the discipline in the four site languages", () => {
  assertEquals([...mentionedDisciplines("I want to run every other day")], ["run"]);
  assertEquals([...mentionedDisciplines("ik wil vaker zwemmen")], ["swim"]);
  assertEquals([...mentionedDisciplines("Ich möchte weniger laufen")], ["run"]);
  assertEquals([...mentionedDisciplines("je veux nager plus")], ["swim"]);
  assertEquals([...mentionedDisciplines("I am travelling Thursday")], []);
});

Deno.test("fitsInstruction - a swimrun session fits both a run and a swim instruction", () => {
  const brick = PROTOTYPE_WEEK.find((session) => session.id === "brick")!;
  const swim = PROTOTYPE_WEEK.find((session) => session.id === "ow-swim")!;
  assertEquals(fitsInstruction(brick, new Set(["run"])), true);
  assertEquals(fitsInstruction(swim, new Set(["run"])), false);
  assertEquals(fitsInstruction(swim, new Set()), true);
});

Deno.test("restDaysRequested reads rest days in English, Dutch, French and German", () => {
  assertEquals(restDaysRequested("I need a rest day on Wednesday"), ["Wed"]);
  assertEquals(restDaysRequested("ik wil woensdag een rustdag"), ["Wed"]);
  assertEquals(restDaysRequested("je voudrais un jour de repos le vendredi"), ["Fri"]);
  assertEquals(restDaysRequested("Ich brauche am Sonntag einen Ruhetag"), ["Sun"]);
  assertEquals(restDaysRequested("Make Wednesday a day off please"), ["Wed"]);
});

Deno.test("restDaysRequested ignores days that are not next to a rest word", () => {
  assertEquals(restDaysRequested("I am travelling Thursday and Friday, so I need a rest day on Wednesday and then move things"), ["Wed"]);
  assertEquals(restDaysRequested("I am travelling Thursday and Friday"), []);
  assertEquals(restDaysRequested("Run the rest of the week on Tuesday"), []);
});

Deno.test("the prototype week has no problems, and a session on a rest day is one", () => {
  assertEquals(weekIssues(PROTOTYPE_WEEK, []), []);
  assertEquals(weekIssues(PROTOTYPE_WEEK, ["Wed"]).map((issue) => issue.kind), ["rest-day"]);
});

Deno.test("two sessions on a day, and runs on consecutive days, are problems", () => {
  const clash = applyMoves(PROTOTYPE_WEEK, [{ id: "flex", toDay: "Thu", reason: "" }]);
  assertEquals(weekIssues(clash, []).map((issue) => issue.kind), ["clash"]);
  const runs = applyMoves(PROTOTYPE_WEEK, [{ id: "intervals", toDay: "Fri", reason: "" }]);
  assertEquals(weekIssues(runs, []).map((issue) => issue.kind), ["back-to-back-runs"]);
});

Deno.test("checkMoves keeps moves off rest days", () => {
  const moves = [{ id: "brick", toDay: "Wed", reason: "" }, { id: "trail", toDay: "Fri", reason: "" }] as const;
  const { allowed, rejected } = checkMoves(["Wed"], moves);
  assertEquals(allowed.map((move) => move.id), ["trail"]);
  assertEquals(rejected.map((move) => move.id), ["brick"]);
});

Deno.test("planRestDay moves only the sessions of that day, to the free day, and nothing else", () => {
  const plan = planRestDay(PROTOTYPE_WEEK, [], "Wed");
  assertEquals(plan.restDays, ["Wed"]);
  assertEquals(plan.moves.map(({ id, toDay }) => [id, toDay]), [["flex", "Fri"]]);
  const after = applyMoves(PROTOTYPE_WEEK, plan.moves);
  assertEquals(weekIssues(after, plan.restDays), []);
});

Deno.test("planRestDay never puts a session on another rest day", () => {
  const plan = planRestDay(PROTOTYPE_WEEK, ["Fri"], "Wed");
  assertEquals(plan.restDays, ["Wed", "Fri"]);
  assert(plan.moves.every((move) => !plan.restDays.includes(move.toDay)));
});

Deno.test("planRestDay on an empty day changes nothing but the rest days", () => {
  const plan = planRestDay(PROTOTYPE_WEEK, [], "Fri");
  assertEquals(plan.moves, []);
  assertEquals(plan.restDays, ["Fri"]);
});

Deno.test("suggestFixes looks one step ahead and moves the later session of a problem", () => {
  const runs = applyMoves(PROTOTYPE_WEEK, [{ id: "intervals", toDay: "Fri", reason: "" }]);
  const [fix, ...rest] = suggestFixes(runs, []);
  assertEquals(fix.resolves.kind, "back-to-back-runs");
  assertEquals(fix.move.id, "intervals");
  assertEquals(rest, []);
  assertEquals(weekIssues(applyMoves(runs, [fix.move]), []), []);
});

Deno.test("suggestFixes has nothing to suggest for a week without problems", () => {
  assertEquals(suggestFixes(PROTOTYPE_WEEK, []), []);
});
