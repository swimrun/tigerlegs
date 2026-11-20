import { buildTableRows, type TableConfig } from "../client/table-renderer.ts";
import type { Segment, SegmentTotals } from "../shared/types.ts";
import type { ConflictInfo } from "../client/strategy-combiner.ts";
import { localizeNumber } from "../client/numbers.ts";
import { useExtractorT } from "./useExtractorT.ts";

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
  const { t, lang } = useExtractorT();
  const num = (text: string | number) => localizeNumber(String(text), lang);
  const types = config.swimFirst ? ["swim", "run"] as const : ["run", "swim"] as const;
  const rows = buildTableRows(segments, config, conflicts);
  const headings = ["#", ...types.map(type => type === "swim" ? t("table.swimM") : t("table.runKm")),
    ...(config.showCumulative ? [t("table.totalSoFar")] : []), t("table.detectedBy"), t("table.confidence")];
  const button = (segment: Segment, text: string, label: string) =>
    <button type="button" className="segment-select" aria-label={label} aria-pressed={selected === segment.number}
      onClick={event => { event.stopPropagation(); select(segment.number); }}
      onMouseEnter={() => preview(segment.number)}>{text}</button>;
  return <table id="segments" aria-label={t("table.label")} aria-describedby="segment-help"
    onKeyDown={event => { if (event.key === "Escape") clear(); }}>
    <thead><tr>{headings.map(text => <th key={text} scope="col">{text}</th>)}</tr></thead>
    <tbody>
      {!rows.length && <tr><td colSpan={headings.length}>{t("table.none")}</td></tr>}
      {rows.map(model => {
        const first = model.segments[0];
        const isBreak = first.type === "unclassified";
        return <tr key={first.number} data-segment-numbers={model.segments.map(s => s.number).join(",")}
          className={model.segments.some(s => s.number === active) ? "active" : ""}
          onClick={() => select(first.number)} onMouseEnter={() => preview(first.number)} onMouseLeave={() => preview(null)}>
          <td>{isBreak ? button(first, t("table.breakKm", { km: num(first.distanceKm.toFixed(1)) }),
            t("table.selectBreak", { number: first.number, km: num(first.distanceKm.toFixed(1)) })) : model.pair.number}</td>
          {types.map(type => {
            const segment = model.segments.find(s => s.type === type);
            const distance = type === "swim" ? model.pair.swimDistanceM : model.pair.runDistanceKm;
            return <td key={type}>{segment ? button(segment, num(distance),
              t("table.selectSegment", { number: segment.number, type: t(`table.${type}`), distance: num(distance), unit: type === "swim" ? "m" : "km" })) : "—"}</td>;
          })}
          {config.showCumulative && <td>{num(model.cumulativeKm)}</td>}
          <td>{model.segments.map(s => `${s.type === "unclassified" ? t("table.break") : t(`table.${s.type}`)}: ${s.detectedBy.join(" + ") || "—"}`).join("; ")}
            {model.conflicts.map(conflict => <span key={conflict.trackpointIndex}
              title={t("table.conflictTitle", { strategies: conflict.strategies.join(" / "), index: conflict.trackpointIndex, resolvedBy: conflict.resolvedBy })}>{t("table.boundaryConflict")}</span>)}</td>
          <td>{num(model.pair.confidenceScore.toFixed(2))}</td>
        </tr>;
      })}
    </tbody>
    <tfoot><tr id="totals-row"><td>{t("table.total")}</td>
      {types.map(type => <td key={type}>{num(type === "swim" ? totals.totalSwimM : totals.totalRunKm)}</td>)}
      {config.showCumulative && <td>{num(rows.at(-1)?.cumulativeKm ?? "0.0")}</td>}
      <td>—</td><td>—</td></tr></tfoot>
  </table>;
}
