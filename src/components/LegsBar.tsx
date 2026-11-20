import { useState } from "react";
import { barLegs, formatLegDistance, formatLegDuration, legLabel } from "../client/legs-bar.ts";
import type { Segment, Trackpoint } from "../shared/types.ts";
import { useExtractorT } from "./useExtractorT.ts";

const COLOUR = { swim: "var(--color-swim)", run: "var(--color-run)", unclassified: "var(--color-unclassified)" };

/**
 * A bar under the map with the legs in order, as wide as their share of the distance, blue for a swim and green for
 * a run. Hovering or focusing a leg shows a panel with its type, distance and duration; choosing it selects the
 * segment, as in the table. Every leg is a button, so the keyboard and a screen reader reach it.
 */
export default function LegsBar({ segments, points, active, selected, select, preview }: {
  segments: readonly Segment[];
  points: readonly Trackpoint[];
  active: number | null;
  selected: number | null;
  select: (number: number) => void;
  preview: (number: number | null) => void;
}) {
  const { t, lang } = useExtractorT();
  const names = { swim: t("legs.swim").toLowerCase(), run: t("legs.run").toLowerCase(), unclassified: t("legs.break").toLowerCase(), leg: t("legs.leg") };
  const titles = { swim: t("legs.swim"), run: t("legs.run"), unclassified: t("legs.break") };
  const legs = barLegs(segments, points);
  const [shown, setShown] = useState<number | null>(null);
  if (legs.length === 0) return null;
  const leg = legs.find((candidate) => candidate.number === shown);
  const show = (number: number | null) => { setShown(number); preview(number); };
  return (
    <div className="relative mt-2" data-legs-bar>
      {leg && (
        <div role="status" data-leg-panel
          className="pointer-events-none absolute bottom-full z-10 mb-1 -translate-x-1/2 whitespace-nowrap rounded border border-stone-900 bg-white px-2 py-1 text-xs shadow"
          style={{ left: `${Math.min(86, Math.max(14, (leg.start + leg.share / 2) * 100))}%` }}>
          <strong>{titles[leg.type]} {leg.number}</strong>: {formatLegDistance(leg.distanceKm, lang)}
          {leg.durationSeconds !== null && <>, {formatLegDuration(leg.durationSeconds)}</>}
        </div>
      )}
      <div role="group" aria-label={t("legs.group")} className="flex h-6 w-full gap-px overflow-hidden rounded border border-stone-300 bg-white">
        {legs.map((item) => (
          <button key={item.number} type="button" data-leg={item.number} data-leg-type={item.type}
            aria-label={legLabel(item, names, lang)} aria-pressed={selected === item.number}
            onClick={() => select(item.number)}
            onMouseEnter={() => show(item.number)} onMouseLeave={() => show(null)}
            onFocus={() => show(item.number)} onBlur={() => show(null)}
            className={`h-full focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-stone-950 ${active === item.number ? "ring-2 ring-inset ring-stone-950" : ""}`}
            style={{ flexGrow: item.share, flexBasis: 0, minWidth: "6px", backgroundColor: COLOUR[item.type] }} />
        ))}
      </div>
    </div>
  );
}
