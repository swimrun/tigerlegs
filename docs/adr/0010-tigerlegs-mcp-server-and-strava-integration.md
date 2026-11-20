# 10. TigerLegs MCP server and Strava integration

Date: 2026-11-09

## 1. Status

Draft. No decision has been taken; this record collects the context, options and constraints for the ideation in issue #20. It becomes Proposed once milestone M9 (accounts and backend) is in sight.

## 2. Context

Two goals are planned beyond course analysis:

- **Training plans towards goal events.** A swimrunner plans towards an A race with intermediate B/C races; a coach drafts plans with LLM support but keeps explicit approval. Plans cover trail running, open-water swimming, strength, and static and dynamic flexibility.
- **Talk to your training data.** A swimrunner connects an MCP client (Claude, ChatGPT, Codex, Cursor, …) to a TigerLegs MCP server and asks about training in plain language, from a swimrun perspective rather than a running-only one.

The Model Context Protocol is an open standard through which an LLM client discovers and calls tools and resources on a remote server, with OAuth for authorisation (Anthropic, n.d.). Stryd ships exactly this shape for running: a remote MCP server at a fixed URL, OAuth sign-in, typed resources such as activities, planned workouts and events, and coach relationships that let an agent read athletes who shared their profile (Stryd, n.d.). Augo, an AI training-plan tool that includes strength training, ships the same shape coach-first: its MCP server lets a coach ask Claude or ChatGPT about their athletes, create workouts and build reports, signed in as the coach and scoped to that coach's athletes (Augo, n.d.). That is working prior art for the swimrun variant TigerLegs would offer — and it narrows the gap TigerLegs would fill: swimrun-specific data (legs, transitions, open water) with an athlete-first, local-first stance, rather than running-only (Stryd) or coach-platform (Augo).

Strava is the obvious activity source for most swimrunners. Its API agreement was tightened in November 2024: a user's data obtained through the API may, in short, only be displayed to that user themself, and API data may not be used to train AI models; coaching tools that give feedback to the connecting user remain allowed (Strava, 2024). Two consequences follow:

- The "coach reads the athlete's Strava-derived data" flow needs a careful legal reading. It may need the athlete to share through TigerLegs-native consent rather than through raw Strava data display, or the coach flow may have to work on TigerLegs-derived plans and summaries only.
- Passing a user's Strava data to an LLM for *answering that user's own questions* is inference, not model training, but the boundary must be documented and enforced.

Existing constraints and principles apply in full: analysis stays local where possible, the backend runs in the EU ([ADR-0004](./0004-host-deno-backend-on-eu-vps.md)), the stack stays Deno/TypeScript ([ADR-0002](./0002-use-deno-with-typescript.md)), the API stays REST/JSON where it serves multiple clients ([ADR-0005](./0005-rest-json-api-for-multi-client-support.md)), and privacy is a design rule: stored activities and plans reveal home locations and daily patterns, so this feature cannot ship before the M9 accounts-and-privacy review.

## 3. Options under consideration

| Option | Reasons to consider | Reasons against, here |
| --- | --- | --- |
| **A. Remote TigerLegs MCP server with Strava OAuth passthrough** | One server URL, any MCP client, the Stryd pattern; swimrun-specific tools (legs, transitions, open-water conditions) | Requires accounts, token storage, rate limiting, hosting — all of M9; Strava terms constrain coach visibility |
| **B. Local/stdio MCP server the athlete runs themself** | No stored tokens on our side, strongest privacy, fits local-first principle | Setup burden per user; no coach flow; each client machine needs Strava credentials |
| **C. No MCP; built-in chat over training data in the web app** | Full control over UI and consent; builds on the existing chat prototype (guidebook 7.2) | Locks users into our chat instead of their preferred agent; duplicates what MCP clients already do well |
| **D. Do nothing until demand is shown** | The fake-door principle: measure interest first (issue #11 analytics) | Delays learning about Strava-terms feasibility, which gates everything above |
| **E. On-device inference with Chrome's built-in Gemini Nano (Prompt API)** | Athlete-side tasks such as rearranging the week's sessions run locally: private, offline, free; JSON-schema-constrained output fits the propose-confirm-sync flow; Chrome's component updater owns the model download and updates, not TigerLegs | Chrome desktop only (no Safari/Firefox/most mobile); steep hardware floor (~22 GB free disk, 16 GB RAM); a one-off multi-GB opt-in download; output languages limited (de, en, es, fr, ja); too small for full plan generation |

Option E is complementary, not competing: it serves the athlete's in-week interactions in the web app, while plan *generation* stays with the coach and a frontier model (A/B), and C/D remain the delivery and gating questions. The rule for E is **AI-assisted, not AI-dependent** — the same shape as "terrain-informed, not terrain-dependent": the schedule must be fully editable by hand, Nano is an enhancement behind a single `LanguageModel.availability()` capability check with a fallback ladder (no API → hide the assist; `downloadable` → opt-in download with progress; `unavailable` → hide the assist or offer a cloud opt-in). Verified on a MacBook Pro (November 2026): availability moved `downloadable` → `downloading` → `available`, with the model delivered per Chrome channel (Chrome and Chrome Canary each download their own copy). Languages: Nano supports de, en, es, fr and ja — matching the chat prototype's English, German and French, but not Dutch; Dutch-speaking users fall back to English rather than adding a translation step or a cloud call.

A fake-door test fits the house principle "fake it till you make it": advertise the capability, measure clicks, build nothing heavy until interest is shown.

## 4. Decision

None yet. The working hypothesis to validate is option **A** for the long term, prototyped via **B** (a local MCP server over an exported TigerLegs course and a Strava export file), with **D**'s measurement gating the investment.

## 5. Consequences and validation

- Validate the Strava API agreement reading before design: can a coach ever see Strava-derived data of an athlete, and under what consent?
- A prototype local MCP server can be built against exported GPX/course JSON without accounts, keeping the privacy promise intact.
- Any stored training data triggers the M9 privacy review; EU hosting per ADR-0004.
- LLM-drafted plans follow the evidence rule: a draft is evidence, the coach's approval is the label. No plan changes without explicit human approval.
- On-device assists (option E) must degrade gracefully: every AI-assisted interaction needs a manual equivalent, and the two code paths (with and without the Prompt API) both need test coverage.
- Revisit this draft when M9 planning starts; then record a real decision with alternatives weighed per the multi-criteria method used in ADR-0008/0009.

## References

- Anthropic. (n.d.). *Model Context Protocol*. https://modelcontextprotocol.io/
- Augo. (n.d.). *Connect augo to Claude and ChatGPT*. Retrieved November 9, 2026, from https://www.augotraining.com/en/mcp
- Strava. (2024, November 19). *Updates to Strava's API agreement*. https://press.strava.com/articles/updates-to-stravas-api-agreement
- Stryd. (n.d.). *Stryd MCP | Explore your Stryd data with AI / SI*. Retrieved November 9, 2026, from https://help.stryd.com/en/articles/17993725-stryd-mcp-explore-your-stryd-data-with-ai-si
