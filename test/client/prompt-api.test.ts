import { assertEquals } from "@std/assert";
import {
  assistAvailability,
  getLanguageModel,
  type LanguageModelSession,
  type LanguageModelStatic,
  parseReply,
  proposeChange,
} from "../../src/client/prompt-api.ts";
import type { TrainingSession } from "../../src/client/training-week.ts";

const WEEK: TrainingSession[] = [
  { id: "trail", day: "Thu", title: "Trail run", discipline: "run" },
  { id: "intervals", day: "Sat", title: "Run intervals", discipline: "run" },
];

function fakeModel(response: string, log: { prompts: string[]; destroyed: boolean }): LanguageModelStatic {
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

Deno.test("proposeChange - sends schedule and instruction, parses moves, destroys the session", async () => {
  const log = { prompts: [] as string[], destroyed: false };
  const response = JSON.stringify({ moves: [{ id: "trail", toDay: "Mon", reason: "travel" }] });
  const reply = await proposeChange(fakeModel(response, log), WEEK, "Move the trail run to Monday.");
  assertEquals(reply, { kind: "moves", moves: [{ id: "trail", toDay: "Mon", reason: "travel" }] });
  assertEquals(log.prompts.length, 1);
  assertEquals(log.prompts[0].includes("trail"), true);
  assertEquals(log.prompts[0].includes("Move the trail run to Monday."), true);
  assertEquals(log.destroyed, true);
});

Deno.test("proposeChange - destroys the session even when the response is malformed", async () => {
  const log = { prompts: [] as string[], destroyed: false };
  let threw = false;
  try {
    await proposeChange(fakeModel("not json", log), WEEK, "anything");
  } catch {
    threw = true;
  }
  assertEquals(threw, true);
  assertEquals(log.destroyed, true);
});

Deno.test("parseReply - a clarification with two known sessions wins over empty moves", () => {
  const json = JSON.stringify({
    moves: [],
    clarification: {
      question: "Which run do you mean?",
      options: [
        { id: "trail", label: "the trail run on Thursday" },
        { id: "intervals", label: "the run intervals on Saturday" },
      ],
    },
  });
  assertEquals(parseReply(json, WEEK), {
    kind: "clarification",
    clarification: {
      question: "Which run do you mean?",
      options: [
        { id: "trail", label: "the trail run on Thursday" },
        { id: "intervals", label: "the run intervals on Saturday" },
      ],
    },
  });
});

Deno.test("parseReply - clarification options naming unknown sessions are dropped", () => {
  const json = JSON.stringify({
    moves: [],
    clarification: {
      question: "Which one?",
      options: [
        { id: "trail", label: "the trail run" },
        { id: "ghost", label: "a hallucinated session" },
      ],
    },
  });
  // One remaining option is no choice: fall back to the (empty) moves.
  assertEquals(parseReply(json, WEEK), { kind: "moves", moves: [] });
});

Deno.test("parseReply - a missing option label falls back to the session title", () => {
  const json = JSON.stringify({
    moves: [],
    clarification: {
      question: "Which run?",
      options: [{ id: "trail" }, { id: "intervals", label: "" }],
    },
  });
  const reply = parseReply(json, WEEK);
  assertEquals(reply.kind, "clarification");
  if (reply.kind === "clarification") {
    assertEquals(reply.clarification.options.map((option) => option.label), [
      "Trail run",
      "Run intervals",
    ]);
  }
});

Deno.test("parseReply - moves win when no usable clarification is present", () => {
  const json = JSON.stringify({ moves: [{ id: "trail", toDay: "Fri", reason: "empty day" }] });
  assertEquals(parseReply(json, WEEK), {
    kind: "moves",
    moves: [{ id: "trail", toDay: "Fri", reason: "empty day" }],
  });
});
