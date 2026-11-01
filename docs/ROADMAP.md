# TigerLegs roadmap

Milestone-level roadmap. The README "Roadmap" section holds the
near-term feature checklist; this document holds the longer horizon and
the open technical questions. New functional requirements are written as
user stories with Given/When/Then acceptance criteria (see
[.github/copilot-instructions.md](../.github/copilot-instructions.md)).

## M0 — Analyze a course in the browser ✅

Speed-based swim/run segmentation, Leaflet map, compact segment table,
sample courses. Done during the June 2026 founding sprint and the
31 October revival.

## M1 — Terrain-informed segmentation (current)

Combine speed evidence with OpenStreetMap water polygons so swims are
found even when pace alone is ambiguous (issue #5: "Swims seem to be
missing").

> As an athlete, given a GPX track crossing a lake at walking pace,
> when I enable "Use terrain data", then the crossing is classified as a
> swim with terrain listed as the detecting strategy.

## M2 — Transition editor

Interactively move, add, merge and delete transitions; corrections
survive re-analysis. Depends on map–table highlighting (README list).

> Given an analysed course with a wrong transition, when I drag the
> transition marker along the track, then the adjacent segment distances
> update and my correction is preserved.

## M3 — Versioned course export format

A compact, versioned format for an analysed course (ordered legs, types,
distances, transition coordinates) that watch platforms can consume —
candidate encodings: FIT course, JSON. Builds on ADR-0005 and ADR-0007.

> Given an analysed course, when I export it, then re-importing it
> reproduces the same legs, and the format carries a schema version.

## M4 — Garmin Connect IQ data field

Monkey C data field showing: current leg number / total (e.g. 3/15),
swim or run, remaining distance of the current leg. Feasibility and
constraints (HTTPS, makeWebRequest, phone proxy) are documented in
[ADR-0005](./adr/0005-rest-json-api-for-multi-client-support.md); the
feature specification lives in
[specs/001-garmin-datafield/spec.md](../specs/001-garmin-datafield/spec.md).

> Given a loaded TigerLegs course, when I pass a transition during an
> activity, then the data field advances to the next leg within one
> GPS fix.

## M5 — Apple Watch and Coros export

Investigate importing the M3 course format on other platforms; friends
with Apple Watch and Coros devices are available as testers. Open
questions: Apple WorkoutKit custom route support, Coros route import
formats (GPX/FIT), what degrades when there is no custom app.

## M6 — Live navigation

Route progress, distance to the next transition and off-course warning
during a race, reusing the M4 leg model.

## M7 — Automatic locomotion detection

Detect swim/run from live sensor data (speed, stroke/cadence) to confirm
or correct planned transitions. Research: GPS accuracy deteriorates
while swimming.

## M8 — Post-activity analysis

Compare planned with observed transitions, refine the course from the
recorded activity, per-leg pacing.

## M9 — Accounts, sharing, monetization

Saving and sharing analysed routes requires a real backend and a privacy
review first (stored routes reveal home locations) — see the README.
Commercial distribution remains an option, not a commitment.

## Technical uncertainties

- Quality and coverage of OSM water polygons for race venues.
- Connect IQ constraints: HTTPS only, JSON via makeWebRequest, memory
  limits of data fields on older watches.
- Apple/Coros: no public API may exist for custom leg-by-leg display;
  export may be limited to plain route files.
- GPS noise during swims: transition detection needs hysteresis.
