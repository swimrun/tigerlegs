import { expect, it } from "vitest";
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

it("getLanguageModel - null when the browser has no Prompt API", () => {
  expect(getLanguageModel({})).toEqual(null);
});

it("getLanguageModel - returns the global LanguageModel when present", () => {
  const model = { availability: () => Promise.resolve("available" as const) };
  expect(getLanguageModel({ LanguageModel: model }) !== null).toEqual(true);
});

it("assistAvailability - absent without a model, else the browser's answer", async () => {
  expect(await assistAvailability(null)).toEqual("absent");
  const log = { prompts: [], destroyed: false };
  expect(await assistAvailability(fakeModel("{}", log))).toEqual("available");
});

it("proposeChange - sends schedule and instruction, parses moves, destroys the session", async () => {
  const log = { prompts: [] as string[], destroyed: false };
  const response = JSON.stringify({ moves: [{ id: "trail", toDay: "Mon", reason: "travel" }] });
  const reply = await proposeChange(fakeModel(response, log), WEEK, "Move the trail run to Monday.");
  expect(reply).toEqual({ kind: "moves", moves: [{ id: "trail", toDay: "Mon", reason: "travel" }], restDays: [] });
  expect(log.prompts.length).toEqual(1);
  expect(log.prompts[0].includes("trail")).toEqual(true);
  expect(log.prompts[0].includes("Move the trail run to Monday.")).toEqual(true);
  expect(log.destroyed).toEqual(true);
});

it("proposeChange - destroys the session even when the response is malformed", async () => {
  const log = { prompts: [] as string[], destroyed: false };
  let threw = false;
  try {
    await proposeChange(fakeModel("not json", log), WEEK, "anything");
  } catch {
    threw = true;
  }
  expect(threw).toEqual(true);
  expect(log.destroyed).toEqual(true);
});

it("parseReply - a clarification with two known sessions wins over empty moves", () => {
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
  expect(parseReply(json, WEEK)).toEqual({
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

it("parseReply - clarification options naming unknown sessions are dropped", () => {
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
  expect(parseReply(json, WEEK)).toEqual({ kind: "moves", moves: [], restDays: [] });
});

it("parseReply - a missing option label falls back to the session title", () => {
  const json = JSON.stringify({
    moves: [],
    clarification: {
      question: "Which run?",
      options: [{ id: "trail" }, { id: "intervals", label: "" }],
    },
  });
  const reply = parseReply(json, WEEK);
  expect(reply.kind).toEqual("clarification");
  if (reply.kind === "clarification") {
    expect(reply.clarification.options.map((option) => option.label)).toEqual([
      "Trail run",
      "Run intervals",
    ]);
  }
});

it("parseReply - moves win when no usable clarification is present", () => {
  const json = JSON.stringify({ moves: [{ id: "trail", toDay: "Fri", reason: "empty day" }] });
  expect(parseReply(json, WEEK)).toEqual({
    kind: "moves",
    moves: [{ id: "trail", toDay: "Fri", reason: "empty day" }],
    restDays: [],
  });
});

it("parseReply - restDays are read, kept in week order and cleaned of unknown days", () => {
  const json = JSON.stringify({ moves: [], restDays: ["Fri", "Wed", "Funday", "Wed"] });
  expect(parseReply(json, WEEK)).toEqual({ kind: "moves", moves: [], restDays: ["Wed", "Fri"] });
});

it("proposeChange tells the model the rest days and the system prompt forbids moving onto them", async () => {
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
  expect(prompts[0].includes('Rest days: ["Wed"]')).toBeTruthy();
  expect(systems[0].includes("never move a session onto a rest day")).toBeTruthy();
  expect(systems[0].includes("return that day in restDays")).toBeTruthy();
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

it("narrowByDiscipline - a run instruction never offers the swim", () => {
  const reply = parseReply(clarify("trail", "intervals", "ow-swim"), MIXED);
  expect(narrowByDiscipline(reply, MIXED, "I want to run every other day")).toEqual({
    kind: "clarification",
    clarification: {
      question: "Move which run?",
      options: [{ id: "trail", label: "trail" }, { id: "intervals", label: "intervals" }],
    },
  });
});

it("narrowByDiscipline - leaves the model's options alone when no discipline is named", () => {
  const reply = parseReply(clarify("trail", "intervals", "ow-swim"), MIXED);
  expect(narrowByDiscipline(reply, MIXED, "I am travelling Thursday")).toEqual(reply);
});

it("proposeChange - one candidate left after narrowing is used without asking", async () => {
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
  expect(reply.kind).toEqual("moves");
  expect(prompts.length).toEqual(2);
  expect(prompts[1].includes('session id "trail"')).toEqual(true);
});

it("proposeChange asks the model for reasons in the page language", async () => {
  const systems: string[] = [];
  const outputs: unknown[] = [];
  const model: LanguageModelStatic = {
    availability: () => Promise.resolve("available"),
    create: (options) => {
      systems.push(options?.initialPrompts?.[0]?.content ?? "");
      outputs.push(options?.expectedOutputs);
      return Promise.resolve({ prompt: () => Promise.resolve(JSON.stringify({ moves: [] })), destroy: () => {} });
    },
  };
  await proposeChange(model, WEEK, "Verschiebe den Lauf", undefined, [], "de");
  expect(systems[0].includes("Write every reason and every question in German.")).toBeTruthy();
  expect(outputs[0]).toEqual([{ type: "text", languages: ["de"] }]);
});
