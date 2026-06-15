# 7. Compact Segment Table Format (No Empty Cells)

Date: 2026-06-15

## Status

Accepted

## Context

Swimrun races alternate between swim and run segments. The traditional format used by race organisers (e.g. the Vertical SwimRunMan Laffrey 2026 PDF) uses a table where each row is a single segment:

| # | Run (km) | Swim (m) |
|---|----------|----------|
| 1 |          | 400      |
| 2 | 5.2      |          |
| 3 |          | 2200     |

This produces many empty cells. It wastes space and is impractical when writing distances on swimrun paddles with a thick marker — space is extremely limited.

Additionally, the traditional format often shows false precision (e.g. "387 m" swim or "5.23 km" run) that is meaningless given GPS accuracy and more mportantly - much harder to memorise before a race.

## Decision

**Use a compact paired-row format where each row contains both the
swim distance and the subsequent run distance for that segment pair.**

### Table format

| # | Run �‍♂️ (km) | Swim �‍♀️ (m) |
|---|-------------|------------|
| 1 | 5.2         | 400        |
| 2 | 0.3         | 2200       |
| 3 | 1.4         | 400        |
| **Tot** | 24.8  | 6100       |

Key rules:

1. **No empty cells** — every cell in the table body contains a value.
   The only exception is when the race starts with a swim (no run
   before the first swim) or ends without a swim (no swim after last
   run), in which case that first/last row may have a dash (`—`) to
   explicitly indicate absence.
2. **Column order toggleable** — Default is "run first" (Run | Swim),
   which matches the typical swimrun race structure where you start
   with a run. A "swim first" toggle reorders columns to Swim | Run
   for atypical races that start with a swim (e.g. Vertical
   SwimRunMan Laffrey 2026).
3. **One row = one transition pair** — Row N shows run N and the swim
   that follows it (default), or swim N and the run that follows it
   (in swim-first mode).

### Rounding rules

- **Swim distances**: Rounded to the nearest **50 metres** (not 100m).
  Examples: 387m → 400m, 1125m → 1150m, 2220m → 2200m.
- **Run distances**: Rounded to the nearest **0.1 km** (100 metres).
  Examples: 5.23 km → 5.2 km, 1.37 km → 1.4 km.

These rounding rules reflect practical precision:

- GPS accuracy in open water is ±10–30m; finer than 50m is noise
- Distances are written on paddles by hand; athletes only need order-of-magnitude precision for pacing decisions
- Rounder numbers are easier to memorise and recall mid-race

### Cumulative distance (optional column)

An optional "Cum." column shows cumulative distance (swim + run)
after each row, toggleable in the UI. Cumulative distance uses the
same rounding: 0.1 km for the running total. This is useful for finding which segment you are based on seeing total distance covered on the watch, which most watches have default screen(face) for.

## Consequences

- The segment table renderer produces paired rows instead of one row per activity
- The `DisplaySegment` type and `Segment` model need to support the paired-row concept
- Rounding functions use 50m for swim and 100m (0.1 km) for run
- The traditional "one row per activity" format from race PDFs is NOT replicated — this is an intentional design choice for usability
- Edge case: a race that starts with a swim has the first row showing swim distance only (run cell shows "—"); a race ending with a run has the last row showing run distance only (swim cell shows "—")
- The totals row sums all swim and all run distances independently

## References

- Vertical SwimRunMan Laffrey 2026 race documentation (PDF in assets/)
- swimrun.group README.md — table format specification
