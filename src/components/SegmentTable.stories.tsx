import type { Meta, StoryObj } from "@storybook/react-vite";
import type { Segment } from "../shared/types.ts";
import SegmentTable from "./SegmentTable.tsx";

const segment = (number: number, type: Segment["type"], distanceKm: number): Segment => ({
  number,
  type,
  startTrackpointIndex: number * 10,
  endTrackpointIndex: number * 10 + 9,
  distanceKm,
  detectedBy: ["speed"],
  confidenceScore: 0.9,
  gpsFiltered: false,
});

const segments = [
  segment(1, "run", 5.2),
  segment(2, "swim", 0.4),
  segment(3, "run", 3.1),
  segment(4, "swim", 0.8),
];

const meta = {
  title: "SegmentTable",
  component: SegmentTable,
  args: {
    segments,
    totals: { totalRunKm: "8.3", totalSwimM: "1200" },
    config: { swimFirst: false, showCumulative: true },
    conflicts: [],
    active: null,
    selected: null,
    select: () => {},
    preview: () => {},
    clear: () => {},
  },
  // The table is described by #segment-help on the real page.
  decorators: [(Story) => <><p id="segment-help">Select a row to highlight it on the map.</p><Story /></>],
} satisfies Meta<typeof SegmentTable>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
export const SwimFirst: Story = { args: { config: { swimFirst: true, showCumulative: false } } };
export const SelectedSegment: Story = { args: { selected: 2, active: 2 } };
export const Empty: Story = { args: { segments: [], totals: { totalRunKm: "0.0", totalSwimM: "0" } } };
