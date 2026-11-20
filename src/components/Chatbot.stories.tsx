import type { Decorator, Meta, StoryObj } from "@storybook/react-vite";
import { expect, userEvent, within } from "storybook/test";
import type { ChatAgent } from "../client/chat-agent.ts";
import Chatbot from "./Chatbot.tsx";

/** A canned agent, so the stories need no network and no 700 ms delay. */
const agent: ChatAgent = {
  suggestions: () =>
    Promise.resolve([
      { id: "tigers-swim", label: "But can tigers actually swim?" },
      { id: "segment-count", label: "How many segments does a swimrun have?" },
    ]),
  async *run(message) {
    yield { type: "run-started" };
    yield {
      type: "text",
      text: `You asked: ${message}. Yes, tigers like water.`,
      followUps: [{ id: "tigers-swim-more", label: "Tell me more", prompt: "more:tigers-swim", completes: "tigers-swim" }],
    };
    yield { type: "run-finished" };
  },
};

const meta = { title: "Chatbot", component: Chatbot, args: { agent } } satisfies Meta<typeof Chatbot>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Collapsed: Story = {};

export const OpenWithSuggestions: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole("button", { name: /ROARRS: Robotic Operating Agent that Responds to Requests about Swimrun/ }));
    await expect(await canvas.findByRole("button", { name: "But can tigers actually swim?" })).toBeVisible();
  },
};

export const Answered: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole("button", { name: /ROARRS: Robotic Operating Agent that Responds to Requests about Swimrun/ }));
    await userEvent.click(await canvas.findByRole("button", { name: "But can tigers actually swim?" }));
    await expect(await canvas.findByRole("button", { name: "Tell me more" })).toBeVisible();
  },
};

export const Dutch: Story = {
  decorators: [
    (Story) => {
      document.documentElement.lang = "nl";
      return <Story />;
    },
  ],
  play: async ({ canvasElement }) => {
    await userEvent.click(within(canvasElement).getByRole("button", { name: /ROARRS: Robotic Operating Agent that Responds to Requests about Swimrun/ }));
  },
};

/** An agent that proposes a change as a card (ADR-0019) and answers its buttons like chips. */
const proposalAgent: ChatAgent = {
  suggestions: () => Promise.resolve([{ id: "propose", label: "Move my Tuesday run" }]),
  async *run(message) {
    yield { type: "run-started" };
    if (message === "apply-proposal") {
      yield { type: "text", text: "Done: the run is now a swim." };
    } else if (message === "dismiss-proposal") {
      yield { type: "text", text: "Okay, nothing changed." };
    } else {
      yield {
        type: "text",
        text: "I propose to swap Tuesday's run for a swim.",
        ui: { component: "ChangeProposal", props: { title: "Proposed moves", changes: [{ label: "Tuesday", before: "Run, 45 min", after: "Swim, 2 km" }] } },
        uiActions: {
          apply: { id: "apply", label: "Apply", prompt: "apply-proposal", completes: "dismiss" },
          dismiss: { id: "dismiss", label: "Dismiss", prompt: "dismiss-proposal", completes: "apply" },
        },
      };
    }
    yield { type: "run-finished" };
  },
};

/** The page language outlives a story in the same browser, so the stories that read texts set it themselves. */
const english: Decorator = (Story) => {
  document.documentElement.lang = "en";
  return <Story />;
};

export const ProposalCard: Story = {
  args: { agent: proposalAgent },
  decorators: [english],
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole("button", { name: /ROARRS: Robotic Operating Agent that Responds to Requests about Swimrun/ }));
    await userEvent.click(await canvas.findByRole("button", { name: "Move my Tuesday run" }));
    await expect(await canvas.findByRole("heading", { name: "Proposed moves" })).toBeVisible();
    await expect(canvas.getByText("Was: Run, 45 min")).toBeVisible();
    await userEvent.click(canvas.getByRole("button", { name: "Apply" }));
    await expect(await canvas.findByText("Done: the run is now a swim.")).toBeVisible();
    // Like a chip, the buttons are used up once one is chosen.
    await expect(canvas.queryByRole("button", { name: "Dismiss" })).toBeNull();
  },
};

/** A component that is not in the catalog is ignored: the text is still there, and there are no buttons. */
export const UnknownComponent: Story = {
  decorators: [english],
  args: {
    agent: {
      suggestions: () => Promise.resolve([{ id: "ask", label: "Show me something" }]),
      async *run() {
        yield { type: "run-started" };
        yield { type: "text", text: "Here it is in words.", ui: { component: "Carousel", props: {} } };
        yield { type: "run-finished" };
      },
    },
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole("button", { name: /ROARRS: Robotic Operating Agent that Responds to Requests about Swimrun/ }));
    await userEvent.click(await canvas.findByRole("button", { name: "Show me something" }));
    await expect(await canvas.findByText("Here it is in words.")).toBeVisible();
    await expect(canvas.queryByRole("button", { name: "Apply" })).toBeNull();
  },
};
