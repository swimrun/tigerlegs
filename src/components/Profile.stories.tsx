import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, userEvent, within } from "storybook/test";
import Profile from "./Profile.tsx";

const meta = {
  title: "Profile",
  component: Profile,
  beforeEach: () => sessionStorage.clear(),
} satisfies Meta<typeof Profile>;
export default meta;
type Story = StoryObj<typeof meta>;

export const LoggedOut: Story = {};

export const LoggedIn: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(await canvas.findByRole("button", { name: "Log in" }));
    await expect(await canvas.findByRole("article")).toBeVisible();
  },
};
