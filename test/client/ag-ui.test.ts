import { assert, assertEquals } from "@std/assert";
import { EventSchemas } from "@ag-ui/core/schemas";
import type { ChatAgent, ChatEvent } from "../../src/client/chat-agent.ts";
import { runAsAgUi, toAgUiEvents } from "../../src/client/ag-ui.ts";

const RUN = { threadId: "thread-1", runId: "run-1" };

async function collect<T>(events: AsyncIterable<T>): Promise<T[]> {
  const out: T[] = [];
  for await (const event of events) out.push(event);
  return out;
}

async function* chat(events: ChatEvent[]): AsyncGenerator<ChatEvent> {
  yield* events;
}

Deno.test("a chat run becomes a valid AG-UI run with a text message", async () => {
  const events = await collect(toAgUiEvents(
    chat([{ type: "run-started" }, { type: "text", text: "Hello" }, { type: "run-finished" }]),
    RUN,
  ));
  assertEquals(events.map((event) => event.type), [
    "RUN_STARTED",
    "TEXT_MESSAGE_START",
    "TEXT_MESSAGE_CONTENT",
    "TEXT_MESSAGE_END",
    "RUN_FINISHED",
  ]);
  for (const event of events) assert(EventSchemas.safeParse(event).success, JSON.stringify(event));
});

Deno.test("status and suggestion chips travel as CUSTOM events", async () => {
  const events = await collect(toAgUiEvents(
    chat([
      { type: "run-started" },
      { type: "status", text: "Downloading 40%" },
      { type: "text", text: "Apply?", followUps: [{ id: "apply-1", label: "Apply", prompt: "apply-proposal" }] },
      { type: "run-finished" },
    ]),
    RUN,
  ));
  const custom = events.filter((event) => event.type === "CUSTOM") as unknown as { name: string; value: unknown }[];
  assertEquals(custom.map((event) => event.name), ["status", "followUps"]);
  assertEquals(custom[0].value, "Downloading 40%");
  assertEquals(custom[1].value, [{ id: "apply-1", label: "Apply", prompt: "apply-proposal" }]);
  for (const event of events) assert(EventSchemas.safeParse(event).success, JSON.stringify(event));
});

Deno.test("two text messages in one run get different message ids", async () => {
  const events = await collect(toAgUiEvents(
    chat([{ type: "run-started" }, { type: "text", text: "one" }, { type: "text", text: "two" }, { type: "run-finished" }]),
    RUN,
  ));
  const ids = new Set(events.flatMap((event) => "messageId" in event ? [String(event.messageId)] : []));
  assertEquals(ids.size, 2);
});

Deno.test("an agent that throws ends the run with RUN_ERROR", async () => {
  async function* failing(): AsyncGenerator<ChatEvent> {
    yield { type: "run-started" };
    throw new Error("model gone");
  }
  const events = await collect(toAgUiEvents(failing(), RUN));
  assertEquals(events.map((event) => event.type), ["RUN_STARTED", "RUN_ERROR"]);
  for (const event of events) assert(EventSchemas.safeParse(event).success, JSON.stringify(event));
});

Deno.test("runAsAgUi runs a ChatAgent on a message", async () => {
  const agent: ChatAgent = {
    suggestions: () => Promise.resolve([]),
    run: (message: string) => chat([{ type: "run-started" }, { type: "text", text: `echo ${message}` }, { type: "run-finished" }]),
  };
  const events = await collect(runAsAgUi(agent, "hi", RUN));
  assertEquals(events.length, 5);
});
