# TigerLegs product vision

**T**errain **I**nformed **G**px **E**xtracto**R**: **LE**ts **G**o **S**wimrun!

## Why

Swimrun courses alternate trail running and open-water swimming, often a
dozen or more times. Race organisers publish a single GPX track; athletes
are left to work out where the swims start, how long each leg is, and what
to show on their watch during the race. TigerLegs turns that single track
into an explicit, editable course of swim and run segments — and
eventually puts that course on the athlete's wrist.

## Who it is for

1. **Athletes preparing a race** — upload the official GPX, see the legs,
   distances and transitions on a map and in a compact table.
2. **Athletes during a race** — see the current leg, its remaining
   distance and what comes next, on a sports watch.
3. **Athletes and teams after a race** — compare the plan with what
   actually happened and refine the course for next time.

TigerLegs is personal-first: built by and for swimrunners (Team Groot
Rondje Eilanden), with future commercial distribution kept open.

## Product principles

- **Terrain-informed, not terrain-dependent.** Speed-based detection
  always works; terrain data (OpenStreetMap water polygons) improves it
  when available. Classification evidence and confidence stay separate
  from final labels, and manual correction is always possible.
- **Local-first and private.** Analysis runs in the browser; only a
  bounding box goes to OpenStreetMap's Overpass service. Stored routes
  reveal home locations, so any account/storage feature needs its own
  privacy review first.
- **The GPX is sacred.** Original files are never mutated; TigerLegs
  derives, annotates and exports.
- **One course, many screens.** The same course model must serve the web
  map, a compact table, and small watch displays (Garmin first, then
  Apple Watch and Coros).

## Platform strategy

| Platform | Role | Status |
|---|---|---|
| Web (GitHub Pages) | Prepare and analyze courses | Live (beta) |
| Garmin Connect IQ | Race-day data field: leg n/total, swim/run, remaining distance | Planned first — feasibility done in [ADR-0005](./adr/0005-rest-json-api-for-multi-client-support.md) |
| Apple Watch | Course export / companion | Investigate — friends with devices can test |
| Coros | Course export (GPX/FIT route import) | Investigate — friends with devices can test |

The watch strategy drives a key architectural requirement: a compact,
versioned course export format that a Monkey C data field, an Apple
WorkoutKit route and a Coros route import can all consume.

## Where this vision came from

The project started 15 June 2026 as `gpx-to-swimrun-segments` (see the
history in [CONTRIBUTING.md](../CONTRIBUTING.md)). The Garmin ambition
dates from a ChatGPT ideation session on 12 July 2026; the TigerLegs
name, branding and this vision were consolidated on 31 October 2026.

See [ROADMAP.md](./ROADMAP.md) for milestones and the README for the
near-term feature checklist.
