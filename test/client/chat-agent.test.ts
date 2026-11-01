import { assertEquals } from "@std/assert";
import { createFaqAgent, FALLBACK_ANSWER, FAQ } from "../../src/client/chat-agent.ts";

async function collect(message: string) {
  const events = [];
  for await (const event of createFaqAgent().run(message)) events.push(event);
  return events;
}

Deno.test("every suggestion label is answered with its FAQ answer", async () => {
  const agent = createFaqAgent();
  for (const { label } of agent.suggestions()) {
    const events = await collect(label);
    const entry = FAQ.find((e) => e.question === label)!;
    assertEquals(events, [
      { type: "run-started" },
      { type: "text", text: entry.answer },
      { type: "run-finished" },
    ]);
  }
});

Deno.test("matching ignores case and punctuation", async () => {
  const events = await collect("  but can TIGERS actually swim  ");
  assertEquals(events[1], { type: "text", text: FAQ[1].answer });
});

Deno.test("free-text questions get the not-functional-yet answer", async () => {
  const events = await collect("Which wetsuit should I buy?");
  assertEquals(events[1], { type: "text", text: FALLBACK_ANSWER });
});
