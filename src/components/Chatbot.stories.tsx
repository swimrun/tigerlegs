import type { Meta, StoryObj } from "@storybook/react-vite";
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
    await userEvent.click(canvas.getByRole("button", { name: /Ask the tiger/ }));
    await expect(await canvas.findByRole("button", { name: "But can tigers actually swim?" })).toBeVisible();
  },
};

export const Answered: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole("button", { name: /Ask the tiger/ }));
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
    await userEvent.click(within(canvasElement).getByRole("button", { name: /Vraag het de tijger/ }));
  },
};
