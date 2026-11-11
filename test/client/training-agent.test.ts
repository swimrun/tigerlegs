import { assert, assertEquals } from "@std/assert";
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
  applied: "applied",
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
          return Promise.resolve(JSON.stringify({ moves: [{ id: "trail", toDay: "Mon", reason: "Travelling." }] }));
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

Deno.test("training agent: offers the install first, then answers the waiting question without asking again", async () => {
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
  assertEquals(offer.length, 1);
  assertEquals(offer[0].text, "downloadable");
  assertEquals(offer[0].followUps?.map((f) => f.label), ["Install"]);
  assertEquals(prompts.length, 0, "nothing is prompted, and nothing downloads, before the athlete agrees");

  const answer = texts(await collect(agent, offer[0].followUps![0].prompt!));
  assertEquals(prompts.length, 1);
  assert(prompts[0].includes("I am travelling Thursday"), "the original question is asked after the install");
  assertEquals(answer.length, 1);
  assert(answer[0].text.startsWith("# Proposal"));
  assertEquals(answer[0].followUps?.map((f) => f.label), ["Apply", "Dismiss"]);
});

Deno.test("training agent: an install without a waiting question only says it is installed", async () => {
  const agent = createTrainingAgent({
    model: fakeModel([]),
    lang: "en",
    strings,
    chrome: true,
    getWeek: () => PROTOTYPE_WEEK,
    onApply: () => {},
  });
  // The athlete reaches the install through a stale chip, with no question waiting.
  assertEquals(texts(await collect(agent, "install-model")).map((t) => t.text), ["installed"]);
});

Deno.test("training agent: Dutch and other browsers get a hint instead of a prompt", async () => {
  const prompts: string[] = [];
  const base = { model: fakeModel(prompts), strings, getWeek: () => PROTOTYPE_WEEK, onApply: () => {} };
  const dutch = createTrainingAgent({ ...base, lang: "nl", chrome: true });
  assert(texts(await collect(dutch, "ik ga reizen"))[0].text.includes("Engels"));
  const firefox = createTrainingAgent({ ...base, lang: "en", chrome: false });
  assert(texts(await collect(firefox, "I travel"))[0].text.includes("Chrome"));
  assertEquals(prompts.length, 0);
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

Deno.test("training agent: a rest day request is planned by the rules, as a bulleted proposal, without asking the model", async () => {
  const prompts: string[] = [];
  const applied: { moves: Move[]; restDays: Day[] }[] = [];
  const agent = createTrainingAgent({
    model: badModel(prompts, { moves: [{ id: "brick", toDay: "Wed", reason: "rest" }] }),
    lang: "en",
    strings,
    chrome: true,
    getWeek: () => PROTOTYPE_WEEK,
    onApply: (moves, restDays) => applied.push({ moves, restDays }),
  });

  const [proposal] = texts(await collect(agent, "I need a rest day on wednesday"));
  assertEquals(prompts.length, 0, "the rules plan a rest day; the model is not asked");
  assertEquals(proposal.text.split("\n"), [
    "# Proposal",
    "- Wed becomes a rest day",
    "- Flexibility: static + dynamic, 30 min: Wed → Fri — Wed is a rest day",
  ]);
  assertEquals(proposal.followUps?.map((f) => f.label), ["Apply", "Dismiss"]);

  const [done] = texts(await collect(agent, proposal.followUps![0].prompt!));
  assertEquals(done.text, "applied");
  assertEquals(done.followUps, undefined, "a week without problems has no next steps");
  assertEquals(applied.length, 1);
  assertEquals(applied[0].moves.map((move) => [move.id, move.toDay]), [["flex", "Fri"]]);
  assertEquals(applied[0].restDays, ["Wed"]);
});

Deno.test("training agent: a rest day request works without the model, in Dutch and in other browsers", async () => {
  const agent = createTrainingAgent({
    model: null,
    lang: "nl",
    strings,
    chrome: false,
    getWeek: () => PROTOTYPE_WEEK,
    onApply: () => {},
  });
  const [proposal] = texts(await collect(agent, "ik wil woensdag rust"));
  assert(proposal.text.includes("- Wed becomes a rest day"));
});

Deno.test("training agent: a rest day asked for in other words is planned by the rules, whatever the model moved", async () => {
  const prompts: string[] = [];
  const agent = createTrainingAgent({
    model: badModel(prompts, { restDays: ["Wed"], moves: [{ id: "brick", toDay: "Wed", reason: "rest" }] }),
    lang: "en",
    strings,
    chrome: true,
    getWeek: () => PROTOTYPE_WEEK,
    onApply: () => {},
  });
  const [proposal] = texts(await collect(agent, "Give me a breather in the middle of the week"));
  assertEquals(prompts.length, 1);
  assert(proposal.text.includes("- Wed becomes a rest day"));
  assert(!proposal.text.includes("Swimrun brick"), "the model's move onto the rest day is not offered");
});

Deno.test("training agent: a move onto a rest day is left out and says so", async () => {
  const week = applyMoves(PROTOTYPE_WEEK, [{ id: "flex", toDay: "Fri", reason: "" }]);
  const agent = createTrainingAgent({
    model: badModel([], { moves: [{ id: "trail", toDay: "Wed", reason: "x" }] }),
    lang: "en",
    strings,
    chrome: true,
    getWeek: () => week,
    getRestDays: () => ["Wed"],
    onApply: () => {},
  });
  const [answer] = texts(await collect(agent, "Move the trail run earlier"));
  assert(answer.text.includes("- Left out: Trail run, 75 min Z2 to Wed (rest day)"));
  assertEquals(answer.followUps, undefined, "nothing is left to apply");
});

Deno.test("training agent: next steps are listed once and offered as chips after applying, one step at a time", async () => {
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
  assertEquals(proposal.text.split("\n"), [
    "# Proposal",
    "- Mon becomes a rest day",
    "- Strength: Mon → Wed — Mon is a rest day",
    "# Next steps",
    "- Run intervals: Fri → Sat — runs on consecutive days at Fri",
  ]);

  const [applied] = texts(await collect(agent, proposal.followUps![0].prompt!));
  assertEquals(applied.followUps?.map((f) => f.label), ["Next: Run intervals Fri → Sat"]);

  const [next] = texts(await collect(agent, applied.followUps![0].prompt!));
  assertEquals(next.text.split("\n")[0], "# Proposal");
  assert(next.text.includes("- Run intervals: Fri → Sat"));
  assertEquals(next.followUps?.map((f) => f.label), ["Apply", "Dismiss"]);
});
