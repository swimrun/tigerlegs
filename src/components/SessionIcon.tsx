import type { ReactNode } from "react";
import type { TrainingSession } from "../client/training-week.ts";

/**
 * Which icon a session gets (issue #138): a swimmer on the waves of a pool or, in dark blue and bigger, of open
 * water; a runner; the swimmer and the runner together for a swimrun; a dumbbell for strength and a stretching
 * figure for mobility.
 */
export type SessionIconKind = "swim-pool" | "swim-open" | "run" | "swimrun" | "strength" | "mobility";

/** The dark blue (Tailwind blue-900) of the waves of open water; test/client/session-icon.test.ts checks its contrast on a swim card. */
export const OPEN_WATER_BLUE = "#1e3a8a";

export function sessionIconKind(session: Pick<TrainingSession, "discipline" | "water">): SessionIconKind {
  switch (session.discipline) {
    case "swim":
      return session.water === "open" ? "swim-open" : "swim-pool";
    case "run":
      return "run";
    case "swimrun":
      return "swimrun";
    case "strength":
      return "strength";
    case "flexibility":
      return "mobility";
  }
}

function Svg({ size, children }: { size: number; children: ReactNode }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      {children}
    </svg>
  );
}

function Swimmer({ size, water }: { size: number; water: "open" | "pool" }) {
  return (
    <Svg size={size}>
      <circle cx="17" cy="5.5" r="2" fill="currentColor" stroke="none" />
      <path d="M3 11.5c2.5-.5 4-2 6.5-3l3.5 2 3-2.5" />
      {water === "open"
        ? (
          <>
            <path d="M1 16c2.2-3 4.4-3 6.6 0s4.4 3 6.6 0 4.4-3 6.6 0" stroke={OPEN_WATER_BLUE} />
            <path d="M1 21c2.2-3 4.4-3 6.6 0s4.4 3 6.6 0 4.4-3 6.6 0" stroke={OPEN_WATER_BLUE} />
          </>
        )
        : <path d="M2 17.5c1.5-1.2 3-1.2 4.5 0s3 1.2 4.5 0 3-1.2 4.5 0 3 1.2 4.5 0" />}
    </Svg>
  );
}

function Runner({ size }: { size: number }) {
  return (
    <Svg size={size}>
      <circle cx="15" cy="4.5" r="2" fill="currentColor" stroke="none" />
      <path d="M13 8.5l-2 5.5" />
      <path d="M13 9.5l-4 2.5M13 9.5l3.5 2.5" />
      <path d="M11 14l4.5 3.5-1 3.5M11 14l-3.5 3.5-3-1" />
    </Svg>
  );
}

function Dumbbell({ size }: { size: number }) {
  return (
    <Svg size={size}>
      <path d="M6.5 6.5v11M17.5 6.5v11M3.5 9v6M20.5 9v6M6.5 12h11" />
    </Svg>
  );
}

function Stretch({ size }: { size: number }) {
  return (
    <Svg size={size}>
      <circle cx="12" cy="4" r="2" fill="currentColor" stroke="none" />
      <path d="M12 7.5v7M12 9.5L6 5.5M12 9.5l6-4M12 14.5l-3 6M12 14.5l3 6" />
    </Svg>
  );
}

/**
 * The icon beside the title of a session. It is decoration: the title names the discipline in words, so a screen
 * reader skips it, and neither the icon nor its colour is the only signal.
 */
export default function SessionIcon({ session, size = 18 }: { session: Pick<TrainingSession, "discipline" | "water">; size?: number }) {
  const kind = sessionIconKind(session);
  return (
    <span aria-hidden="true" data-icon={kind} className="inline-flex shrink-0 items-center">
      {kind === "swim-pool" && <Swimmer size={size} water="pool" />}
      {kind === "swim-open" && <Swimmer size={size} water="open" />}
      {kind === "run" && <Runner size={size} />}
      {kind === "swimrun" && (
        <>
          <Swimmer size={Math.round(size * 0.85)} water="open" />
          <Runner size={Math.round(size * 0.85)} />
        </>
      )}
      {kind === "strength" && <Dumbbell size={size} />}
      {kind === "mobility" && <Stretch size={size} />}
    </span>
  );
}
