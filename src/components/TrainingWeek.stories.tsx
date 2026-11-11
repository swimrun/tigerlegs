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

/** A rest day is a fixed part of the week: making one moves its sessions out, and nothing can be dropped on it. */
export const RestDayByHand: Story = {
  args: { languageModel: null },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const toggle = await canvas.findByRole("button", { name: "Wednesday: Rest day" });
    await expect(toggle).toHaveAttribute("aria-pressed", "false");
    await userEvent.click(toggle);
    await expect(toggle).toHaveAttribute("aria-pressed", "true");
    // The flexibility session left Wednesday for the free day.
    await expect(await canvas.findByLabelText("Day: Flexibility: static + dynamic, 30 min")).toHaveValue("Fri");
    // Dropping a session on the rest day is refused, with a message.
    const session = (await canvas.findByText("Trail run, 75 min Z2")).closest("li")!;
    const wednesday = (await canvas.findByRole("heading", { name: "Wednesday" })).closest("li")!;
    const dataTransfer = new DataTransfer();
    await fireEvent.dragStart(session, { dataTransfer });
    await fireEvent.dragOver(wednesday, { dataTransfer });
    await fireEvent.drop(wednesday, { dataTransfer });
    await fireEvent.dragEnd(session, { dataTransfer });
    await expect(await canvas.findByText("Wednesday is a rest day: no session can go there.")).toBeVisible();
    await expect(await canvas.findByLabelText("Day: Trail run, 75 min Z2")).toHaveValue("Thu");
  },
};

/** "I need a rest day on Wednesday" is planned by the rules, even without the model, and shown as a bulleted list. */
export const RestDayInChat: Story = {
  args: { languageModel: null },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(await canvas.findByRole("button", { name: /Rearrange with the tiger/ }));
    await userEvent.type(await canvas.findByLabelText("Your question"), "I need a rest day on Wednesday{enter}");
    await expect(await canvas.findByText("Rest day: Wednesday")).toBeVisible();
    await expect(await canvas.findByText(/Flexibility: static \+ dynamic, 30 min: Wednesday → Friday — rest day on Wednesday/)).toBeVisible();
    await userEvent.click(await canvas.findByRole("button", { name: "Apply proposal" }));
    await expect(await canvas.findByRole("button", { name: "Wednesday: Rest day" })).toHaveAttribute("aria-pressed", "true");
    await expect(await canvas.findByLabelText("Day: Flexibility: static + dynamic, 30 min")).toHaveValue("Fri");
  },
};

/** A change can be reverted on its own, or all changes at once; a reset can be undone until something else changes. */
export const RevertAndReset: Story = {
  args: { languageModel: null },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const select = async () => userEvent.selectOptions(await canvas.findByLabelText("Day: Trail run, 75 min Z2"), "Mon");
    await select();
    await expect(await canvas.findByText("Trail run, 75 min Z2: Thursday → Monday")).toBeVisible();
    await userEvent.click(await canvas.findByRole("button", { name: /^Revert/ }));
    await expect(await canvas.findByText("No changes yet.")).toBeVisible();
    await select();
    await userEvent.click(await canvas.findByRole("button", { name: "Reset all changes" }));
    await expect(await canvas.findByText("No changes yet.")).toBeVisible();
    await userEvent.click(await canvas.findByRole("button", { name: "Undo reset" }));
    await expect(await canvas.findByText("Trail run, 75 min Z2: Thursday → Monday")).toBeVisible();
  },
};

/** In German the week, the chat and the apply message are all German, even for a misspelled day. */
export const GermanRestDay: Story = {
  args: { languageModel: null },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    document.documentElement.lang = "de";
    try {
      await expect(await canvas.findByText("Traillauf, 75 Min. Z2")).toBeVisible();
      await userEvent.click(await canvas.findByRole("button", { name: /Tiger/ }));
      await userEvent.type(await canvas.findByLabelText(/Frage/), "Ich will der sontagg als Ruhe.{enter}");
      await expect(await canvas.findByText("Ruhetag: Sonntag")).toBeVisible();
      await userEvent.click(await canvas.findByRole("button", { name: "Vorschlag anwenden" }));
      await expect(await canvas.findByText(/Angewendet: Ruhetag: Sonntag/)).toBeVisible();
      await expect(await canvas.findByText(/unter „Deine Änderungen“ unten/)).toBeVisible();
    } finally {
      document.documentElement.lang = "en";
    }
  },
};
