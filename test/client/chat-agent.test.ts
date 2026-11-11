import { expect, it } from "vitest";
import { readFile } from "node:fs/promises";
import { LANGS } from "../../src/client/language.ts";
import { type ChatEvent, createFaqAgent, type FaqData, parseFaq } from "../../src/client/chat-agent.ts";

const loadFaq = async (lang: string) => parseFaq(JSON.parse(await readFile(`public/chat/faq.${lang}.json`, "utf8")));
const faq = await loadFaq("en");

function stubFetch(body: unknown, status = 200) {
  let calls = 0;
  const fetcher = (() => {
    calls++;
    return Promise.resolve(new Response(JSON.stringify(body), { status }));
  }) as typeof fetch;
  return { fetcher, calls: () => calls };
}

async function collect(agent: ReturnType<typeof createFaqAgent>, message: string) {
  const events: ChatEvent[] = [];
  for await (const event of agent.run(message)) events.push(event);
  return events;
}

const agentFor = (data: unknown = faq) => createFaqAgent("faq.json", { delayMs: 0, fetcher: stubFetch(data).fetcher });

it("every language has the same entries, with a longer answer in the same places", async () => {
  for (const lang of LANGS) {
    const other = await loadFaq(lang);
    expect(other.language).toEqual(lang);
    expect(other.entries.map((e) => [e.id, e.more !== undefined])).toEqual(faq.entries.map((e) => [e.id, e.more !== undefined]));
  }
});

it("the shipped English faq is valid and has entries", () => {
  expect(faq.entries.length > 0).toEqual(true);
  expect(new Set(faq.entries.map((e) => e.id)).size).toEqual(faq.entries.length);
});

it("every suggestion label is answered with its FAQ answer", async () => {
  const agent = agentFor();
  for (const { label } of await agent.suggestions()) {
    const entry = faq.entries.find((e) => e.question === label)!;
    const events = await collect(agent, label);
    expect(events[0]).toEqual({ type: "run-started" });
    expect(events[1].type === "text" && events[1].text).toEqual(entry.answer);
    expect(events[2]).toEqual({ type: "run-finished" });
  }
});

it("an answer with a longer version offers 'Tell me more'", async () => {
  const agent = agentFor();
  const entry = faq.entries.find((e) => e.more)!;
  const first = (await collect(agent, entry.question))[1];
  const followUp = first.type === "text" ? first.followUps?.[0] : undefined;
  expect(followUp?.label).toEqual(faq.tellMore);
  expect((await collect(agent, followUp!.prompt!))[1]).toEqual({ type: "text", text: entry.more! });
});

it("matching ignores case and punctuation", async () => {
  const events = await collect(agentFor(), "  but can TIGERS actually swim  ");
  expect(events[1].type === "text" && events[1].text).toEqual(faq.entries[1].answer);
});

it("free-text questions get the fallback from the JSON", async () => {
  const events = await collect(agentFor(), "Which wetsuit should I buy?");
  expect(events[1]).toEqual({ type: "text", text: faq.fallback });
});

it("the FAQ is fetched once and only when first needed", async () => {
  const { fetcher, calls } = stubFetch(faq);
  const agent = createFaqAgent("faq.json", { delayMs: 0, fetcher });
  expect(calls()).toEqual(0);
  await agent.suggestions();
  await collect(agent, "What is swimrun?");
  expect(calls()).toEqual(1);
});

it("a failed load is reported and retried next time", async () => {
  let ok = false;
  const fetcher = (() => Promise.resolve(new Response(JSON.stringify(faq), { status: ok ? 200 : 500 }))) as typeof fetch;
  const agent = createFaqAgent("faq.json", { delayMs: 0, fetcher });
  await expect((() => agent.suggestions())()).rejects.toThrow(Error);
  ok = true;
  expect((await agent.suggestions()).length).toEqual(faq.entries.length);
});

it("parseFaq rejects malformed data", () => {
  const bad: unknown[] = [null, {}, { fallback: "x" }, { fallback: "x", entries: [{ id: "a", question: "q" }] }];
  for (const data of bad) {
    let failed = false;
    try {
      parseFaq(data as FaqData);
    } catch {
      failed = true;
    }
    expect(failed).toEqual(true);
  }
});
