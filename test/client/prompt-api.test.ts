import { assert, assertEquals } from "@std/assert";
import {
  assistAvailability,
  getLanguageModel,
  type LanguageModelSession,
  type LanguageModelStatic,
  narrowByDiscipline,
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
  assertEquals(reply, { kind: "moves", moves: [{ id: "trail", toDay: "Mon", reason: "travel" }], restDays: [] });
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
  assertEquals(parseReply(json, WEEK), { kind: "moves", moves: [], restDays: [] });
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
    restDays: [],
  });
});

Deno.test("parseReply - restDays are read, kept in week order and cleaned of unknown days", () => {
  const json = JSON.stringify({ moves: [], restDays: ["Fri", "Wed", "Funday", "Wed"] });
  assertEquals(parseReply(json, WEEK), { kind: "moves", moves: [], restDays: ["Wed", "Fri"] });
});

Deno.test("proposeChange tells the model the rest days and the system prompt forbids moving onto them", async () => {
  const prompts: string[] = [];
  const systems: string[] = [];
  const model: LanguageModelStatic = {
    availability: () => Promise.resolve("available"),
    create: (options) => {
      systems.push(options?.initialPrompts?.[0]?.content ?? "");
      return Promise.resolve({
        prompt: (input: string) => {
          prompts.push(input);
          return Promise.resolve(JSON.stringify({ moves: [] }));
        },
        destroy: () => {},
      });
    },
  };
  await proposeChange(model, WEEK, "Move the trail run", undefined, ["Wed"]);
  assert(prompts[0].includes('Rest days: ["Wed"]'));
  assert(systems[0].includes("never move a session onto a rest day"));
  assert(systems[0].includes("return that day in restDays"));
});

const MIXED: TrainingSession[] = [
  ...WEEK,
  { id: "ow-swim", day: "Tue", title: "Open-water swim", discipline: "swim" },
];
const clarify = (...ids: string[]) =>
  JSON.stringify({
    moves: [],
    clarification: { question: "Move which run?", options: ids.map((id) => ({ id, label: id })) },
  });

Deno.test("narrowByDiscipline - a run instruction never offers the swim", () => {
  const reply = parseReply(clarify("trail", "intervals", "ow-swim"), MIXED);
  assertEquals(narrowByDiscipline(reply, MIXED, "I want to run every other day"), {
    kind: "clarification",
    clarification: {
      question: "Move which run?",
      options: [{ id: "trail", label: "trail" }, { id: "intervals", label: "intervals" }],
    },
  });
});

Deno.test("narrowByDiscipline - leaves the model's options alone when no discipline is named", () => {
  const reply = parseReply(clarify("trail", "intervals", "ow-swim"), MIXED);
  assertEquals(narrowByDiscipline(reply, MIXED, "I am travelling Thursday"), reply);
});

Deno.test("proposeChange - one candidate left after narrowing is used without asking", async () => {
  const answers = [
    clarify("trail", "ow-swim"),
    JSON.stringify({ moves: [{ id: "trail", toDay: "Mon", reason: "Runs spread out." }] }),
  ];
  const prompts: string[] = [];
  const model: LanguageModelStatic = {
    availability: () => Promise.resolve("available"),
    create: () =>
      Promise.resolve({
        prompt(input) {
          prompts.push(input);
          return Promise.resolve(answers.shift()!);
        },
        destroy() {},
      }),
  };
  const reply = await proposeChange(model, MIXED, "Move my run to Monday");
  assertEquals(reply.kind, "moves");
  assertEquals(prompts.length, 2);
  assertEquals(prompts[1].includes('session id "trail"'), true);
});
