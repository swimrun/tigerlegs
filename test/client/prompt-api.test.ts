import { assertEquals } from "@std/assert";
import {
  assistAvailability,
  getLanguageModel,
  type LanguageModelSession,
  type LanguageModelStatic,
  proposeMoves,
} from "../../src/client/prompt-api.ts";
import type { TrainingSession } from "../../src/client/training-week.ts";

const WEEK: TrainingSession[] = [
  { id: "trail", day: "Thu", title: "Trail run", discipline: "run" },
];

function fakeModel(
  response: string,
  log: { prompts: string[]; destroyed: boolean },
): LanguageModelStatic {
  const session: LanguageModelSession = {
    prompt(input) {
      log.prompts.push(input);
      return Promise.resolve(response);
    },
    destroy() {
      log.destroyed = true;
    },
  };
  return {
    availability: () => Promise.resolve("available"),
    create: () => Promise.resolve(session),
  };
}

Deno.test("getLanguageModel - null when the browser has no Prompt API", () => {
  assertEquals(getLanguageModel({}), null);
});

Deno.test("getLanguageModel - returns the global LanguageModel when present", () => {
  const model = { availability: () => Promise.resolve("available" as const) };
  assertEquals(getLanguageModel({ LanguageModel: model }) !== null, true);
});

Deno.test("assistAvailability - absent without a model, else the browser's answer", async () => {
  assertEquals(await assistAvailability(null), "absent");
  const log = { prompts: [], destroyed: false };
  assertEquals(await assistAvailability(fakeModel("{}", log)), "available");
});

Deno.test("proposeMoves - sends schedule and instruction, parses moves, destroys the session", async () => {
  const log = { prompts: [] as string[], destroyed: false };
  const response = JSON.stringify({
    moves: [{ id: "trail", toDay: "Mon", reason: "travel" }],
  });
  const moves = await proposeMoves(
    fakeModel(response, log),
    WEEK,
    "I am travelling Thursday.",
  );
  assertEquals(moves, [{ id: "trail", toDay: "Mon", reason: "travel" }]);
  assertEquals(log.prompts.length, 1);
  assertEquals(log.prompts[0].includes("trail"), true);
  assertEquals(log.prompts[0].includes("I am travelling Thursday."), true);
  assertEquals(log.destroyed, true);
});

Deno.test("proposeMoves - destroys the session even when the response is malformed", async () => {
  const log = { prompts: [] as string[], destroyed: false };
  let threw = false;
  try {
    await proposeMoves(fakeModel("not json", log), WEEK, "anything");
  } catch {
    threw = true;
  }
  assertEquals(threw, true);
  assertEquals(log.destroyed, true);
});
