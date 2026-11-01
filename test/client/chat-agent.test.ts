import { assertEquals, assertRejects } from "@std/assert";
import { type ChatEvent, createFaqAgent, type FaqData, parseFaq } from "../../src/client/chat-agent.ts";

const faq = parseFaq(JSON.parse(await Deno.readTextFile("public/chat/faq.json")));

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

Deno.test("the shipped faq.json is valid and has entries", () => {
  assertEquals(faq.entries.length > 0, true);
  assertEquals(new Set(faq.entries.map((e) => e.id)).size, faq.entries.length);
});

Deno.test("every suggestion label is answered with its FAQ answer", async () => {
  const agent = agentFor();
  for (const { label } of await agent.suggestions()) {
    const entry = faq.entries.find((e) => e.question === label)!;
    const events = await collect(agent, label);
    assertEquals(events[0], { type: "run-started" });
    assertEquals(events[1].type === "text" && events[1].text, entry.answer);
    assertEquals(events[2], { type: "run-finished" });
  }
});

Deno.test("an answer with a longer version offers 'Tell me more'", async () => {
  const agent = agentFor();
  const entry = faq.entries.find((e) => e.more)!;
  const first = (await collect(agent, entry.question))[1];
  const followUp = first.type === "text" ? first.followUps?.[0] : undefined;
  assertEquals(followUp?.label, "Tell me more");
  assertEquals((await collect(agent, followUp!.prompt!))[1], { type: "text", text: entry.more! });
});

Deno.test("matching ignores case and punctuation", async () => {
  const events = await collect(agentFor(), "  but can TIGERS actually swim  ");
  assertEquals(events[1].type === "text" && events[1].text, faq.entries[1].answer);
});

Deno.test("free-text questions get the fallback from the JSON", async () => {
  const events = await collect(agentFor(), "Which wetsuit should I buy?");
  assertEquals(events[1], { type: "text", text: faq.fallback });
});

Deno.test("the FAQ is fetched once and only when first needed", async () => {
  const { fetcher, calls } = stubFetch(faq);
  const agent = createFaqAgent("faq.json", { delayMs: 0, fetcher });
  assertEquals(calls(), 0);
  await agent.suggestions();
  await collect(agent, "What is swimrun?");
  assertEquals(calls(), 1);
});

Deno.test("a failed load is reported and retried next time", async () => {
  let ok = false;
  const fetcher = (() => Promise.resolve(new Response(JSON.stringify(faq), { status: ok ? 200 : 500 }))) as typeof fetch;
  const agent = createFaqAgent("faq.json", { delayMs: 0, fetcher });
  await assertRejects(() => agent.suggestions(), Error, "500");
  ok = true;
  assertEquals((await agent.suggestions()).length, faq.entries.length);
});

Deno.test("parseFaq rejects malformed data", () => {
  const bad: unknown[] = [null, {}, { fallback: "x" }, { fallback: "x", entries: [{ id: "a", question: "q" }] }];
  for (const data of bad) {
    let failed = false;
    try {
      parseFaq(data as FaqData);
    } catch {
      failed = true;
    }
    assertEquals(failed, true);
  }
});
