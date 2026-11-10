import { assert, assertEquals } from "@std/assert";
import type { ChatEvent } from "../../src/client/chat-agent.ts";
import type { LanguageModelStatic } from "../../src/client/prompt-api.ts";
import { createTrainingAgent, type TrainingAgentStrings } from "../../src/client/training-agent.ts";
import { PROTOTYPE_WEEK } from "../../src/client/training-week.ts";

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
  assert(answer[0].text.startsWith("Proposal"));
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
