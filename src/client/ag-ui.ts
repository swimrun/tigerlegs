import { type BaseEvent, EventType } from "@ag-ui/core";
import type { ChatAgent, ChatEvent } from "./chat-agent.ts";

/**
 * The chat agents of TigerLegs speak `ChatEvent`; this turns that stream into AG-UI events (the Agent-User
 * Interaction protocol, @ag-ui/core), so that an agent here can be consumed by any AG-UI client and an
 * AG-UI agent can later replace one of ours. The mapping:
 *
 * - `run-started` and `run-finished` become RUN_STARTED and RUN_FINISHED;
 * - `text` becomes TEXT_MESSAGE_START, TEXT_MESSAGE_CONTENT and TEXT_MESSAGE_END;
 * - `status` (a model download, say) and the suggestion chips of a `text` have no AG-UI event of their own and
 *   travel as CUSTOM events named "status" and "followUps";
 * - an agent that throws ends the run with RUN_ERROR.
 */
export async function* toAgUiEvents(
  events: AsyncIterable<ChatEvent>,
  run: { threadId: string; runId: string },
): AsyncGenerator<BaseEvent> {
  let messages = 0;
  try {
    for await (const event of events) {
      switch (event.type) {
        case "run-started":
          yield { type: EventType.RUN_STARTED, threadId: run.threadId, runId: run.runId } as BaseEvent;
          break;
        case "status":
          yield { type: EventType.CUSTOM, name: "status", value: event.text } as BaseEvent;
          break;
        case "text": {
          const messageId = `${run.runId}-message-${++messages}`;
          yield { type: EventType.TEXT_MESSAGE_START, messageId, role: "assistant" } as BaseEvent;
          yield { type: EventType.TEXT_MESSAGE_CONTENT, messageId, delta: event.text } as BaseEvent;
          yield { type: EventType.TEXT_MESSAGE_END, messageId } as BaseEvent;
          if (event.followUps?.length) {
            yield { type: EventType.CUSTOM, name: "followUps", value: event.followUps } as BaseEvent;
          }
          break;
        }
        case "run-finished":
          yield { type: EventType.RUN_FINISHED, threadId: run.threadId, runId: run.runId } as BaseEvent;
          break;
      }
    }
  } catch (error) {
    yield { type: EventType.RUN_ERROR, message: error instanceof Error ? error.message : String(error) } as BaseEvent;
  }
}

/** Runs a chat agent on one message and returns what it did as AG-UI events. */
export function runAsAgUi(
  agent: ChatAgent,
  message: string,
  run: { threadId: string; runId: string },
): AsyncGenerator<BaseEvent> {
  return toAgUiEvents(agent.run(message), run);
}
