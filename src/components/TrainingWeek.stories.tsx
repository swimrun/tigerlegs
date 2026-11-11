import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, fireEvent, userEvent, within } from "storybook/test";
import Chatbot from "./Chatbot.tsx";
import TrainingWeek from "./TrainingWeek.tsx";
import type { LanguageModelStatic } from "../client/prompt-api.ts";

const meta = {
  title: "TrainingWeek",
  component: TrainingWeek,
  // The chat lives in the site layout; the story mounts it beside the page like the layout does.
  render: (args) => (
    <>
      <TrainingWeek {...args} />
      <Chatbot />
    </>
  ),
} satisfies Meta<typeof TrainingWeek>;
export default meta;
type Story = StoryObj<typeof meta>;

/** Without the Prompt API the assistant hides and manual rearranging still works. */
export const WithoutAssistant: Story = {
  args: { languageModel: null },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(await canvas.findByRole("list", { name: "Training week" }))
      .toBeVisible();
    // Nothing to confirm before a change has been made.
    await expect(canvas.queryByRole("button", { name: "Confirm new week" })).toBeNull();
    const day = await canvas.findByLabelText("Day: Trail run, 75 min Z2");
    await userEvent.selectOptions(day, "Mon");
    await expect(
      await canvas.findByText("Trail run, 75 min Z2: Thursday → Monday"),
    ).toBeVisible();
    const confirm = await canvas.findByRole("button", {
      name: "Confirm new week",
    });
    await userEvent.click(confirm);
    await expect(await canvas.findByText(/New week confirmed/)).toBeVisible();
  },
};

const fakeNano: LanguageModelStatic = {
  availability: () => Promise.resolve("available"),
  create: () =>
    Promise.resolve({
      prompt: () =>
        Promise.resolve(JSON.stringify({
          moves: [{
            id: "trail",
            toDay: "Mon",
            reason: "Travelling Thursday.",
          }],
        })),
      destroy: () => {},
    }),
};

/** With a (fake) model: instruction → proposal → apply → confirm, all through the shared chat. */
export const ProposeApplyConfirm: Story = {
  args: { languageModel: fakeNano },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(
      await canvas.findByRole("button", { name: /Rearrange with the tiger/ }),
    );
    await userEvent.type(
      await canvas.findByLabelText("Your question"),
      "I am travelling Thursday and Friday{enter}",
    );
    await expect(await canvas.findByText(/Travelling Thursday\./)).toBeVisible();
    await userEvent.click(
      await canvas.findByRole("button", { name: "Apply proposal" }),
    );
    await expect(
      await canvas.findByText("Trail run, 75 min Z2: Thursday → Monday"),
    ).toBeVisible();
    await userEvent.click(
      await canvas.findByRole("button", { name: "Confirm new week" }),
    );
    await expect(await canvas.findByText(/New week confirmed/)).toBeVisible();
  },
};

/** Dragging a session onto another day moves it and lists the change; the selector still works. */
export const DragAndDrop: Story = {
  args: { languageModel: null },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const session = (await canvas.findByText("Trail run, 75 min Z2")).closest("li")!;
    const monday = (await canvas.findByRole("heading", { name: "Monday" })).closest("li")!;
    const dataTransfer = new DataTransfer();
    await fireEvent.dragStart(session, { dataTransfer });
    await fireEvent.dragOver(monday, { dataTransfer });
    await fireEvent.drop(monday, { dataTransfer });
    await fireEvent.dragEnd(session, { dataTransfer });
    await expect(await canvas.findByText("Trail run, 75 min Z2: Thursday → Monday")).toBeVisible();
    // The selector of the session shows the new day.
    await expect(await canvas.findByLabelText("Day: Trail run, 75 min Z2")).toHaveValue("Mon");
  },
};
