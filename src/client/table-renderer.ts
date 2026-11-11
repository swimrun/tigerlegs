import type {
  DisplaySegmentPair,
  Segment,
  SegmentTotals,
} from "../shared/types.ts";
import type { ConflictInfo } from "./strategy-combiner.ts";
import {
  groupSegmentsForDisplay,
  pairSegmentsForDisplay,
  roundRunDistance,
} from "./segment-builder.ts";

export interface TableConfig {
  swimFirst: boolean;
  showCumulative: boolean;
}

export interface TableRow {
  pair: DisplaySegmentPair;
  segments: Segment[];
  cumulativeKm: string;
  conflicts: ConflictInfo[];
}

export interface TableSelection {
  select(number: number): void;
  preview(number: number | null): void;
  clear(): void;
}

export function buildTableRows(
  segments: Segment[],
  config: TableConfig,
  conflicts: ConflictInfo[] = [],
): TableRow[] {
  const groups = groupSegmentsForDisplay(segments, config.swimFirst);
  const pairs = pairSegmentsForDisplay(segments, config.swimFirst);
  let cumulative = 0;
  return groups.map((group, index) => {
    cumulative += group.reduce((sum, segment) => sum + segment.distanceKm, 0);
    return {
      pair: pairs[index],
      segments: group,
      cumulativeKm: roundRunDistance(cumulative).toFixed(1),
      conflicts: conflicts.filter((conflict) =>
        group.some((segment) =>
          conflict.trackpointIndex >= segment.startTrackpointIndex &&
          conflict.trackpointIndex <= segment.endTrackpointIndex
        )
      ),
    };
  });
}

export function renderEmptyState(
  tbody: HTMLTableSectionElement,
  columns: number,
) {
  const row = tbody.insertRow();
  const cell = row.insertCell();
  cell.colSpan = columns;
  cell.textContent = "No segments found";
}

export function renderTable(
  table: HTMLTableElement,
  segments: Segment[],
  totals: SegmentTotals,
  config: TableConfig,
  conflicts: ConflictInfo[],
  selection: TableSelection,
) {
  const document = table.ownerDocument;
  const types = config.swimFirst
    ? ["swim", "run"] as const
    : ["run", "swim"] as const;
  const headings = [
    "#",
    ...types.map((type) => type === "swim" ? "Swim (m)" : "Run (km)"),
    ...(config.showCumulative ? ["Cumulative (km)"] : []),
    "Detected by",
    "Confidence",
  ];
  const head = table.tHead ?? table.createTHead();
  head.replaceChildren();
  const header = head.insertRow();
  for (const text of headings) {
    const cell = document.createElement("th");
    cell.scope = "col";
    cell.textContent = text;
    header.append(cell);
  }
  const tbody = table.tBodies[0] ?? table.createTBody();
  tbody.replaceChildren();
  const rows = new Map<number, HTMLTableRowElement>();
  const buttons = new Map<number, HTMLButtonElement>();
  const models = buildTableRows(segments, config, conflicts);
  for (const model of models) {
    const row = tbody.insertRow();
    const first = model.segments[0];
    const isBreak = first.type === "unclassified";
    row.insertCell().textContent = isBreak
      ? `Break (${first.distanceKm.toFixed(1)} km)`
      : String(model.pair.number);
    for (const type of types) {
      const cell = row.insertCell();
      const segment = model.segments.find((item) => item.type === type);
      if (!segment) {
        cell.textContent = "—";
        continue;
      }
      const distance = type === "swim"
        ? model.pair.swimDistanceM
        : model.pair.runDistanceKm;
      const button = document.createElement("button");
      button.type = "button";
      button.className = "segment-select";
      button.textContent = distance;
      button.setAttribute(
        "aria-label",
        `Select segment ${segment.number}: ${type}, ${distance} ${
          type === "swim" ? "m" : "km"
        }`,
      );
      button.setAttribute("aria-pressed", "false");
      button.addEventListener("click", (event) => {
        event.stopPropagation();
        selection.select(segment.number);
      });
      button.addEventListener(
        "mouseenter",
        () => selection.preview(segment.number),
      );
      cell.append(button);
      buttons.set(segment.number, button);
    }
    if (isBreak) {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "segment-select";
      button.textContent = row.cells[0].textContent;
      button.setAttribute(
        "aria-label",
        `Select break segment ${first.number}, ${
          first.distanceKm.toFixed(1)
        } km`,
      );
      button.setAttribute("aria-pressed", "false");
      row.cells[0].replaceChildren(button);
      buttons.set(first.number, button);
    }
    if (config.showCumulative) {
      row.insertCell().textContent = model.cumulativeKm;
    }
    const detection = row.insertCell();
    detection.textContent = model.segments.map((segment) =>
      `${segment.type === "unclassified" ? "Break" : segment.type}: ${
        segment.detectedBy.join(" + ") || "—"
      }`
    ).join("; ");
    for (const conflict of model.conflicts) {
      const flag = document.createElement("span");
      flag.textContent = " · Boundary conflict";
      flag.title = `${
        conflict.strategies.join(" / ")
      } disagree at point ${conflict.trackpointIndex}; resolved by ${conflict.resolvedBy}`;
      detection.append(flag);
    }
    row.insertCell().textContent = model.pair.confidenceScore.toFixed(2);
    for (const segment of model.segments) rows.set(segment.number, row);
    row.addEventListener("click", () => selection.select(first.number));
    row.addEventListener("mouseenter", () => selection.preview(first.number));
    row.addEventListener("mouseleave", () => selection.preview(null));
    row.addEventListener("keydown", (event) => {
      if (event.key === "Escape") selection.clear();
    });
  }
  if (models.length === 0) renderEmptyState(tbody, headings.length);
  const foot = table.tFoot ?? table.createTFoot();
  foot.replaceChildren();
  const total = foot.insertRow();
  total.id = "totals-row";
  total.insertCell().textContent = "Total";
  for (const type of types) {
    total.insertCell().textContent = type === "swim"
      ? totals.totalSwimM
      : totals.totalRunKm;
  }
  if (config.showCumulative) {
    total.insertCell().textContent = models.at(-1)?.cumulativeKm ?? "0.0";
  }
  total.insertCell().textContent = "—";
  total.insertCell().textContent = "—";
  return { rows, buttons };
}
