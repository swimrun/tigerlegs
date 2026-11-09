import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, userEvent, within } from "storybook/test";
import TrainingWeek from "./TrainingWeek.tsx";
import type { LanguageModelStatic } from "../client/prompt-api.ts";

const meta = {
  title: "TrainingWeek",
  component: TrainingWeek,
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

/** With a (fake) model: instruction → proposal diff → apply → confirm. */
export const ProposeApplyConfirm: Story = {
  args: { languageModel: fakeNano },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.type(
      await canvas.findByLabelText("Your instruction"),
      "I am travelling Thursday and Friday",
    );
    await userEvent.click(
      await canvas.findByRole("button", { name: "Propose moves" }),
    );
    await expect(await canvas.findByText("Proposed moves")).toBeVisible();
    await expect(await canvas.findByText(/Travelling Thursday\./))
      .toBeVisible();
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
