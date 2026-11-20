import type { Segment, Trackpoint } from "../shared/types.ts";
import type { Lang } from "./language.ts";
import { localizeNumber } from "./numbers.ts";

/** One leg as the bar under the map shows it. */
export interface BarLeg {
  number: number;
  type: Segment["type"];
  /** Where the leg starts as a fraction of the whole distance, 0 to 1. */
  start: number;
  /** The share of the whole distance, 0 to 1. */
  share: number;
  distanceKm: number;
  /** Null when the file has no usable timestamps. */
  durationSeconds: number | null;
}

export function barLegs(segments: readonly Segment[], points: readonly Trackpoint[]): BarLeg[] {
  const total = segments.reduce((sum, segment) => sum + segment.distanceKm, 0);
  let before = 0;
  return segments.map((segment) => {
    const startTime = points[segment.startTrackpointIndex]?.timestamp;
    const endTime = points[segment.endTrackpointIndex]?.timestamp;
    const seconds = startTime && endTime ? (new Date(endTime).getTime() - new Date(startTime).getTime()) / 1000 : null;
    const leg: BarLeg = {
      number: segment.number,
      type: segment.type,
      start: total > 0 ? before / total : 0,
      share: total > 0 ? segment.distanceKm / total : 0,
      distanceKm: segment.distanceKm,
      durationSeconds: seconds !== null && Number.isFinite(seconds) && seconds >= 0 ? Math.round(seconds) : null,
    };
    before += segment.distanceKm;
    return leg;
  });
}

/** "1.30 km" from 1 km up, "150 m" (to 10 m) below. */
export function formatLegDistance(km: number, lang: Lang = "en"): string {
  return km >= 1 ? `${localizeNumber(km.toFixed(2), lang)} km` : `${Math.round((km * 1000) / 10) * 10} m`;
}

/** "32 min 29 s", "1 h 2 min", "45 s". */
export function formatLegDuration(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const rest = seconds % 60;
  if (hours > 0) return `${hours} h ${minutes} min`;
  if (minutes > 0) return `${minutes} min ${rest} s`;
  return `${rest} s`;
}

/** What a screen reader reads, and the panel shows: "swim, leg 3, 1.30 km, 32 min 29 s". */
export function legLabel(leg: BarLeg, names: { swim: string; run: string; unclassified: string; leg: string }, lang: Lang = "en"): string {
  const parts = [`${names[leg.type]}, ${names.leg} ${leg.number}`, formatLegDistance(leg.distanceKm, lang)];
  if (leg.durationSeconds !== null) parts.push(formatLegDuration(leg.durationSeconds));
  return parts.join(", ");
}
