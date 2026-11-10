import { assertEquals, assertThrows } from "@std/assert";
import {
  applyMoves,
  changedSessions,
  type Day,
  fitsInstruction,
  isDay,
  mentionedDisciplines,
  parseProposal,
  PROTOTYPE_WEEK,
  type TrainingSession,
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
