import { buildTableRows, type TableConfig } from "../client/table-renderer.ts";
import type { Segment, SegmentTotals } from "../shared/types.ts";
import type { ConflictInfo } from "../client/strategy-combiner.ts";

interface Props {
  segments: Segment[];
  totals: SegmentTotals;
  config: TableConfig;
  conflicts: ConflictInfo[];
  active: number | null;
  selected: number | null;
  select(number: number): void;
  preview(number: number | null): void;
  clear(): void;
}

export default function SegmentTable(props: Props) {
  const { segments, totals, config, conflicts, active, selected, select, preview, clear } = props;
  const types = config.swimFirst ? ["swim", "run"] as const : ["run", "swim"] as const;
  const rows = buildTableRows(segments, config, conflicts);
  const headings = ["#", ...types.map(t => t === "swim" ? "Swim (m)" : "Run (km)"),
    ...(config.showCumulative ? ["Total so far (km)"] : []), "Detected by", "Confidence"];
  const button = (segment: Segment, text: string, label: string) =>
    <button type="button" className="segment-select" aria-label={label} aria-pressed={selected === segment.number}
      onClick={event => { event.stopPropagation(); select(segment.number); }}
      onMouseEnter={() => preview(segment.number)}>{text}</button>;
  return <table id="segments" aria-label="Swimrun segments" aria-describedby="segment-help"
    onKeyDown={event => { if (event.key === "Escape") clear(); }}>
    <thead><tr>{headings.map(text => <th key={text} scope="col">{text}</th>)}</tr></thead>
    <tbody>
      {!rows.length && <tr><td colSpan={headings.length}>No segments found</td></tr>}
      {rows.map(model => {
        const first = model.segments[0];
        const isBreak = first.type === "unclassified";
        return <tr key={first.number} data-segment-numbers={model.segments.map(s => s.number).join(",")}
          className={model.segments.some(s => s.number === active) ? "active" : ""}
          onClick={() => select(first.number)} onMouseEnter={() => preview(first.number)} onMouseLeave={() => preview(null)}>
          <td>{isBreak ? button(first, `Break (${first.distanceKm.toFixed(1)} km)`,
            `Select break segment ${first.number}, ${first.distanceKm.toFixed(1)} km`) : model.pair.number}</td>
          {types.map(type => {
            const segment = model.segments.find(s => s.type === type);
            const distance = type === "swim" ? model.pair.swimDistanceM : model.pair.runDistanceKm;
            return <td key={type}>{segment ? button(segment, distance,
              `Select segment ${segment.number}: ${type}, ${distance} ${type === "swim" ? "m" : "km"}`) : "—"}</td>;
          })}
          {config.showCumulative && <td>{model.cumulativeKm}</td>}
          <td>{model.segments.map(s => `${s.type === "unclassified" ? "Break" : s.type}: ${s.detectedBy.join(" + ") || "—"}`).join("; ")}
            {model.conflicts.map(conflict => <span key={conflict.trackpointIndex}
              title={`${conflict.strategies.join(" / ")} disagree at point ${conflict.trackpointIndex}; resolved by ${conflict.resolvedBy}`}> · Boundary conflict</span>)}</td>
          <td>{model.pair.confidenceScore.toFixed(2)}</td>
        </tr>;
      })}
    </tbody>
    <tfoot><tr id="totals-row"><td>Total</td>
      {types.map(type => <td key={type}>{type === "swim" ? totals.totalSwimM : totals.totalRunKm}</td>)}
      {config.showCumulative && <td>{rows.at(-1)?.cumulativeKm ?? "0.0"}</td>}
      <td>—</td><td>—</td></tr></tfoot>
  </table>;
}
