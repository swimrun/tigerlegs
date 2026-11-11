import { expect, it } from "vitest";
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

it("a chat run becomes a valid AG-UI run with a text message", async () => {
  const events = await collect(toAgUiEvents(
    chat([{ type: "run-started" }, { type: "text", text: "Hello" }, { type: "run-finished" }]),
    RUN,
  ));
  expect(events.map((event) => event.type)).toEqual([
    "RUN_STARTED",
    "TEXT_MESSAGE_START",
    "TEXT_MESSAGE_CONTENT",
    "TEXT_MESSAGE_END",
    "RUN_FINISHED",
  ]);
  for (const event of events) expect(EventSchemas.safeParse(event).success, JSON.stringify(event)).toBeTruthy();
});

it("status and suggestion chips travel as CUSTOM events", async () => {
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
  expect(custom.map((event) => event.name)).toEqual(["status", "followUps"]);
  expect(custom[0].value).toEqual("Downloading 40%");
  expect(custom[1].value).toEqual([{ id: "apply-1", label: "Apply", prompt: "apply-proposal" }]);
  for (const event of events) expect(EventSchemas.safeParse(event).success, JSON.stringify(event)).toBeTruthy();
});

it("two text messages in one run get different message ids", async () => {
  const events = await collect(toAgUiEvents(
    chat([{ type: "run-started" }, { type: "text", text: "one" }, { type: "text", text: "two" }, { type: "run-finished" }]),
    RUN,
  ));
  const ids = new Set(events.flatMap((event) => "messageId" in event ? [String(event.messageId)] : []));
  expect(ids.size).toEqual(2);
});

it("an agent that throws ends the run with RUN_ERROR", async () => {
  async function* failing(): AsyncGenerator<ChatEvent> {
    yield { type: "run-started" };
    throw new Error("model gone");
  }
  const events = await collect(toAgUiEvents(failing(), RUN));
  expect(events.map((event) => event.type)).toEqual(["RUN_STARTED", "RUN_ERROR"]);
  for (const event of events) expect(EventSchemas.safeParse(event).success, JSON.stringify(event)).toBeTruthy();
});

it("runAsAgUi runs a ChatAgent on a message", async () => {
  const agent: ChatAgent = {
    suggestions: () => Promise.resolve([]),
    run: (message: string) => chat([{ type: "run-started" }, { type: "text", text: `echo ${message}` }, { type: "run-finished" }]),
  };
  const events = await collect(runAsAgUi(agent, "hi", RUN));
  expect(events.length).toEqual(5);
});
