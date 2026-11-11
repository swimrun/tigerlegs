import { expect, it } from "vitest";
import type { ChatEvent } from "../../src/client/chat-agent.ts";
import type { LanguageModelStatic } from "../../src/client/prompt-api.ts";
import { createTrainingAgent, type TrainingAgentStrings } from "../../src/client/training-agent.ts";
import { applyMoves, type Day, type Move, PROTOTYPE_WEEK, type TrainingSession } from "../../src/client/training-week.ts";

const strings: TrainingAgentStrings = {
  assistAbsent: "absent",
  assistUnavailable: "unavailable",
  assistDownloadable: "downloadable",
  assistEnable: "Install",
  assistDownloading: "Downloading",
  assistInstalled: "installed",
  assistFailed: "failed",
  proposalTitle: "Proposal",
  proposalEmpty: "empty",
  apply: "Apply",
  applied: (summary) => `applied: ${summary}`,
  sessionTitle: (session) => session.title,
  dismiss: "Dismiss",
  dismissed: "dismissed",
  days: { Mon: "Mon", Tue: "Tue", Wed: "Wed", Thu: "Thu", Fri: "Fri", Sat: "Sat", Sun: "Sun" },
  movedFromTo: (title, from, to) => `${title}: ${from} → ${to}`,
  nextStepsTitle: "Next steps",
  restDayBecomes: (day) => `${day} becomes a rest day`,
  restDayReason: (day) => `${day} is a rest day`,
  restDayAlready: (day) => `${day} is already a rest day`,
  leftOut: (title, day) => `Left out: ${title} to ${day} (rest day)`,
  nextChip: (title, from, to) => `Next: ${title} ${from} → ${to}`,
  fixReasons: {
    "rest-day": (day) => `${day} is a rest day`,
    clash: (day) => `two sessions on ${day}`,
    "back-to-back-runs": (day) => `runs on consecutive days at ${day}`,
  },
};

/** Availability goes downloadable → available once a session was created, like Chrome's own download. */
function fakeModel(prompts: string[]): LanguageModelStatic {
  let installed = false;
  return {
    availability: () => Promise.resolve(installed ? "available" : "downloadable"),
    create: () => {
      installed = true;
      return Promise.resolve({
        prompt: (input: string) => {
          prompts.push(input);
          return Promise.resolve(JSON.stringify({ moves: [{ id: "run-1", toDay: "Fri", reason: "Travelling." }] }));
        },
        destroy: () => {},
      });
    },
  };
}

async function collect(agent: ReturnType<typeof createTrainingAgent>, message: string) {
  const events: ChatEvent[] = [];
  for await (const event of agent.run(message)) events.push(event);
  return events;
}

const texts = (events: ChatEvent[]) => events.flatMap((event) => event.type === "text" ? [event] : []);

it("training agent: offers the install first, then answers the waiting question without asking again", async () => {
  const prompts: string[] = [];
  const agent = createTrainingAgent({
    model: fakeModel(prompts),
    lang: "en",
    strings,
    chrome: true,
    getWeek: () => PROTOTYPE_WEEK,
    onApply: () => {},
  });

  const offer = texts(await collect(agent, "I am travelling Thursday"));
  expect(offer.length).toEqual(1);
  expect(offer[0].text).toEqual("downloadable");
  expect(offer[0].followUps?.map((f) => f.label)).toEqual(["Install"]);
  expect(prompts.length, "nothing is prompted, and nothing downloads, before the athlete agrees").toEqual(0);

  const answer = texts(await collect(agent, offer[0].followUps![0].prompt!));
  expect(prompts.length).toEqual(1);
  expect(prompts[0].includes("I am travelling Thursday"), "the original question is asked after the install").toBeTruthy();
  expect(answer.length).toEqual(1);
  expect(answer[0].text.startsWith("# Proposal")).toBeTruthy();
  expect(answer[0].followUps?.map((f) => f.label)).toEqual(["Apply", "Dismiss"]);
});

it("training agent: an install without a waiting question only says it is installed", async () => {
  const agent = createTrainingAgent({
    model: fakeModel([]),
    lang: "en",
    strings,
    chrome: true,
    getWeek: () => PROTOTYPE_WEEK,
    onApply: () => {},
  });
  // The athlete reaches the install through a stale chip, with no question waiting.
  expect(texts(await collect(agent, "install-model")).map((t) => t.text)).toEqual(["installed"]);
});

it("training agent: Dutch and other browsers get a hint instead of a prompt", async () => {
  const prompts: string[] = [];
  const base = { model: fakeModel(prompts), strings, getWeek: () => PROTOTYPE_WEEK, onApply: () => {} };
  const dutch = createTrainingAgent({ ...base, lang: "nl", chrome: true });
  expect(texts(await collect(dutch, "ik ga reizen"))[0].text.includes("Engels")).toBeTruthy();
  const firefox = createTrainingAgent({ ...base, lang: "en", chrome: false });
  expect(texts(await collect(firefox, "I travel"))[0].text.includes("Chrome")).toBeTruthy();
  expect(prompts.length).toEqual(0);
});

/** A model that would put the brick on Wednesday, the very day the athlete wants to keep free. */
function badModel(prompts: string[], reply: object): LanguageModelStatic {
  return {
    availability: () => Promise.resolve("available"),
    create: () =>
      Promise.resolve({
        prompt: (input: string) => {
          prompts.push(input);
          return Promise.resolve(JSON.stringify(reply));
        },
        destroy: () => {},
      }),
  };
}

it("training agent: a rest day request is planned by the rules, as a bulleted proposal, without asking the model", async () => {
  const prompts: string[] = [];
  const applied: { moves: Move[]; restDays: Day[] }[] = [];
  const agent = createTrainingAgent({
    model: badModel(prompts, { moves: [{ id: "swimrun-1", toDay: "Wed", reason: "rest" }] }),
    lang: "en",
    strings,
    chrome: true,
    getWeek: () => PROTOTYPE_WEEK,
    onApply: (moves, restDays) => applied.push({ moves, restDays }),
  });

  const [proposal] = texts(await collect(agent, "I need a rest day on wednesday"));
  expect(prompts.length, "the rules plan a rest day; the model is not asked").toEqual(0);
  expect(proposal.text.split("\n")).toEqual([
    "# Proposal",
    "- Wed becomes a rest day",
    "- Strength: legs, 15 min: Wed → Thu — Wed is a rest day",
  ]);
  expect(proposal.followUps?.map((f) => f.label)).toEqual(["Apply", "Dismiss"]);

  const [done] = texts(await collect(agent, proposal.followUps![0].prompt!));
  expect(done.text).toEqual("applied: Wed becomes a rest day; Strength: legs, 15 min: Wed → Thu");
  expect(done.followUps, "a week without problems has no next steps").toEqual(undefined);
  expect(applied.length).toEqual(1);
  expect(applied[0].moves.map((move) => [move.id, move.toDay])).toEqual([["strength-1", "Thu"]]);
  expect(applied[0].restDays).toEqual(["Wed"]);
});

it("training agent: a rest day request works without the model, in Dutch and in other browsers", async () => {
  const agent = createTrainingAgent({
    model: null,
    lang: "nl",
    strings,
    chrome: false,
    getWeek: () => PROTOTYPE_WEEK,
    onApply: () => {},
  });
  const [proposal] = texts(await collect(agent, "ik wil woensdag rust"));
  expect(proposal.text.includes("- Wed becomes a rest day")).toBeTruthy();
});

it("training agent: a rest day asked for in other words is planned by the rules, whatever the model moved", async () => {
  const prompts: string[] = [];
  const agent = createTrainingAgent({
    model: badModel(prompts, { restDays: ["Wed"], moves: [{ id: "swimrun-1", toDay: "Wed", reason: "rest" }] }),
    lang: "en",
    strings,
    chrome: true,
    getWeek: () => PROTOTYPE_WEEK,
    onApply: () => {},
  });
  const [proposal] = texts(await collect(agent, "Give me a breather in the middle of the week"));
  expect(prompts.length).toEqual(1);
  expect(proposal.text.includes("- Wed becomes a rest day")).toBeTruthy();
  expect(!proposal.text.includes("Swimrun brick"), "the model's move onto the rest day is not offered").toBeTruthy();
});

it("training agent: rest days the model echoes back are no request, so 'more runs' does not talk about rest days", async () => {
  const agent = createTrainingAgent({
    model: badModel([], { restDays: ["Tue", "Thu"], moves: [] }),
    lang: "en",
    strings,
    chrome: true,
    getWeek: () => PROTOTYPE_WEEK,
    getRestDays: () => ["Tue", "Thu"],
    onApply: () => {},
  });
  const [reply] = texts(await collect(agent, "I want more runs!"));
  expect(reply.text.includes("already a sports rest day")).toEqual(false);
});

it("training agent: a move onto a rest day is left out and says so", async () => {
  const week = applyMoves(PROTOTYPE_WEEK, [{ id: "strength-1", toDay: "Mon", reason: "" }]);
  const agent = createTrainingAgent({
    model: badModel([], { moves: [{ id: "run-1", toDay: "Wed", reason: "x" }] }),
    lang: "en",
    strings,
    chrome: true,
    getWeek: () => week,
    getRestDays: () => ["Wed"],
    onApply: () => {},
  });
  const [answer] = texts(await collect(agent, "Move the trail run earlier"));
  expect(answer.text.includes("- Left out: Trail run, 75 min Z2 to Wed (rest day)")).toBeTruthy();
  expect(answer.followUps, "nothing is left to apply").toEqual(undefined);
});

it("training agent: next steps are listed once and offered as chips after applying, one step at a time", async () => {
  const week: TrainingSession[] = [
    { id: "strength", day: "Mon", title: "Strength", discipline: "strength" },
    { id: "swim", day: "Tue", title: "Swim", discipline: "swim" },
    { id: "trail", day: "Thu", title: "Trail run", discipline: "run" },
    { id: "intervals", day: "Fri", title: "Run intervals", discipline: "run" },
    { id: "flex", day: "Sun", title: "Flexibility", discipline: "flexibility" },
  ];
  const agent = createTrainingAgent({
    model: null,
    lang: "en",
    strings,
    chrome: true,
    getWeek: () => week,
    onApply: () => {},
  });
  const [proposal] = texts(await collect(agent, "I need a rest day on Monday"));
  expect(proposal.text.split("\n")).toEqual([
    "# Proposal",
    "- Mon becomes a rest day",
    "- Strength: Mon → Wed — Mon is a rest day",
    "# Next steps",
    "- Run intervals: Fri → Sat — runs on consecutive days at Fri",
  ]);

  const [applied] = texts(await collect(agent, proposal.followUps![0].prompt!));
  expect(applied.followUps?.map((f) => f.label)).toEqual(["Next: Run intervals Fri → Sat"]);

  const [next] = texts(await collect(agent, applied.followUps![0].prompt!));
  expect(next.text.split("\n")[0]).toEqual("# Proposal");
  expect(next.text.includes("- Run intervals: Fri → Sat")).toBeTruthy();
  expect(next.followUps?.map((f) => f.label)).toEqual(["Apply", "Dismiss"]);
});
