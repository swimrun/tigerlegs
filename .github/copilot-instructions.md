# TigerLegs — Copilot Instructions

TigerLegs stands for: **T**errain **I**nformed **G**px **E**xtracto**R**: **LE**ts **G**o **S**wimrun!

## Product

TigerLegs helps swimrun athletes prepare, navigate and analyze courses
consisting of alternating running and open-water swimming segments.
The project is personal-first and open to future commercial distribution.
See [docs/PRODUCT_VISION.md](../docs/PRODUCT_VISION.md).

## Existing implementation

- Deno with TypeScript; frontend-only analysis (vanilla TS + Leaflet),
  thin Deno backend that proxies OpenStreetMap Overpass with caching.
- GPX parsing plus three detection strategies (waypoint, speed,
  landscape/terrain) combined with confidence scoring.
- Static frontend deploys to GitHub Pages; the site lives in `public/`.

Inspect the repository before assuming details about structure or
implementation. The architecture is documented in the
[software guidebook](../docs/software-guidebook.md) and the
[ADRs](../docs/adr/); the original implementation plan is in
`.kiro/specs/gpx-swimrun-analyzer/`.

## Engineering principles

- Preserve the existing Deno/TypeScript stack (ADR-0002).
- Prefer pure, testable domain functions; property-based tests with
  fast-check use representative GPX fixtures from `test-data/`.
- Separate parsing, classification, route modeling and presentation.
- Keep classification evidence and confidence separate from final
  segment labels. Speed is evidence, not proof, of locomotion.
- Preserve original GPX data; never mutate the input.
- Prefer local, in-browser processing and offline capability; avoid
  unnecessary backend infrastructure (privacy: tracks reveal homes).
- Run `deno task test` and `deno task build` before pushing.

## Requirements style

Write new functional requirements as user stories with BDD
Given/When/Then acceptance criteria — not EARS, even though the
older Kiro specs use EARS.

## Domain concepts

- A course consists of ordered swim/run segments; transitions have
  planned and observed locations.
- Terrain and water classification are imperfect; GPS accuracy
  deteriorates during swimming.
- Segment distances are measured along the route, not between
  endpoints. Manual corrections must remain possible.
- See the glossary in the software guidebook (Appendix A).

## Project documentation

- Near-term feature checklist: README.md "Roadmap" section.
- Milestones and platform strategy: [docs/ROADMAP.md](../docs/ROADMAP.md).
- Working agreements and referencing style (APA 7): [AGENT.md](../AGENT.md).
- File-location rules for agents: [AGENTS.md](../AGENTS.md).
- Documentation changes in the same commit as the behaviour it describes.

Do not implement future roadmap features unless they are explicitly
part of the current task.
