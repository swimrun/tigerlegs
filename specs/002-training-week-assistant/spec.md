# Feature Specification: Training week prototype with on-device AI assistant

**Feature Branch**: `002-training-week-assistant`
**Created**: 2026-11-09
**Status**: Draft
**Input**: Training-plan ideation in issue #20 and roadmap milestones M10/M11 in
[docs/ROADMAP.md](../../docs/ROADMAP.md); architecture options in
[ADR-0010](../../docs/adr/0010-tigerlegs-mcp-server-and-strava-integration.md)
(option E: on-device inference); Prompt API findings in
[issue #10](https://github.com/swimrun/tigerlegs/issues/10); AG-UI research
also in issue #10. Implemented as a fake-door prototype on `/training.html`
(software guidebook, section 7.5).

## User Scenarios & Testing *(mandatory)*

### Primary User Story

As a swimrunner, I want to see this week's training schedule and rearrange
sessions — by hand or by instructing an assistant that runs entirely on my
own device — so that I can adapt my week to real life, see the changes
before they count, and confirm the new plan myself.

The AG-UI division of labour is a hard rule: the model never touches the
screen. It returns a structured proposal (which sessions move to which day,
with a reason); the interface renders that proposal as a diff; the athlete
applies, adjusts or dismisses it and confirms the week explicitly.

### Acceptance Scenarios

1. **Given** the training page in any browser, **When** it loads, **Then**
   it shows the week's sessions per day, each with a day selector, and
   moving a session by hand updates the week and lists the change —
   no AI involved and none required.

2. **Given** a browser without the built-in model API (Safari, Firefox,
   most mobile browsers), **When** the page loads, **Then** a clear notice
   says the assistant only works in Google Chrome on a desktop computer,
   and that rearranging by hand always works.

3. **Given** desktop Chrome where the device cannot run the model,
   **When** the page loads, **Then** the notice explains the device
   requirements (recent computer, roughly 22 GB free disk space) and that
   rearranging by hand always works.

4. **Given** desktop Chrome where the model is supported but not
   installed, **When** the page loads, **Then** the athlete sees an
   **Install Gemini Nano** button with a plain-language warning: a one-off
   download of a few GB, Chrome requires about 22 GB of free disk space as
   headroom, and the schedule never leaves the device.

5. **Given** the athlete chose to install, **When** the download runs,
   **Then** the page shows its progress, and when it completes the
   instruction field appears without a reload.

6. **Given** the model is available and the athlete types "I am travelling
   Thursday and Friday", **When** they ask for a proposal, **Then** the
   proposal moves only Thursday/Friday sessions to other days, shows a
   reason per move, and changes nothing until the athlete applies it.

7. **Given** an applied proposal, **When** the athlete confirms the new
   week, **Then** the confirmation says the plan stays in the browser and
   that syncing to a coach or server is not built yet (prototype).

8. **Given** the model returns an unusable answer (malformed, unknown
   session ids, invalid days), **When** the proposal is processed,
   **Then** invalid moves are dropped or a clear error appears, and manual
   rearranging is unaffected.

### Edge Cases

- The model proposes zero moves: say so; do not invent a change.
- The download is interrupted (tab closed, offline): Chrome resumes it;
  the page reflects the current availability on next load.
- The athlete writes the instruction in Dutch: the model does not support
  Dutch (ADR-0010); the interface states which languages the model
  understands (English, French, German).
- The page language is any of the four site languages: all notices follow
  it, including the Chrome-only and disk-space messages.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The page MUST show the week's sessions grouped per day and
  MUST allow moving any session to another day by hand, in every browser.
- **FR-002**: The page MUST detect assistant capability and show exactly
  one of four states: not offered in this browser (Chrome desktop only),
  device cannot run it (with requirements), installable, or ready.
- **FR-003**: When installable, the page MUST offer the installation as an
  explicit opt-in button and MUST state, before the athlete clicks: the
  one-off download size (a few GB), Chrome's ~22 GB free-disk headroom
  requirement, and that the schedule never leaves the device.
- **FR-004**: During installation the page MUST show progress and MUST
  switch to the ready state without a reload when it finishes.
- **FR-005**: The assistant MUST return a structured proposal (session,
  target day, reason) constrained by a schema; free-text answers are not
  accepted as proposals.
- **FR-006**: A proposal MUST only move existing sessions; it MUST NOT
  add, remove or alter sessions. Moves naming unknown sessions or invalid
  days MUST be dropped.
- **FR-007**: The interface MUST render the proposal as a diff the athlete
  can apply or dismiss; nothing changes until applied, and applied changes
  remain hand-editable before confirming.
- **FR-008**: Confirming the week MUST be an explicit act, and the
  prototype MUST say that the result stays in the browser (no server, no
  coach sync yet).
- **FR-009**: All notices MUST follow the page language (en/nl/fr/de);
  the interface MUST state that the model understands English, French and
  German only.
- **FR-010**: The schedule and instruction MUST NOT leave the device; the
  assistant runs locally and the page makes no network call for it.
- **FR-011**: A proposal MUST move exactly one session by default. Several
  moves are only acceptable when the instruction explicitly names more
  than one session to move ("move the Monday run and the strength
  session…"). Naming a current (IST) and a desired (SOLL) state of the
  same session — "move the Monday run to Wednesday" — counts as one.
- **FR-012**: A proposal MUST NOT place two runs on the same day.

### Iteration 2 (planned, not yet implemented)

Field-testing Gemini Nano (10 November 2026) showed it eagerly rearranges
half the week for a one-session instruction; FR-011/FR-012 now constrain
the system prompt, and the following deepen the interaction model:

- **IST/SOLL vocabulary.** An instruction mostly names the desired (SOLL)
  state and assumes the current (IST) week as context. The domain model
  gains this distinction so prompts, clarifications and tests can speak
  about "which session" (IST) and "where to" (SOLL) separately.
- **Clarify instead of guess.** When several sessions match ("run on
  Friday" with two runs in the week), the assistant asks which one,
  offering the candidates as **suggestion chips** (quick replies), the
  same pattern as the chatbot's FAQ labels.
- **Diff in the schedule, not as prose.** Show the proposed move directly
  in the week grid (ghost card on the target day, highlighted source),
  with a move animation that respects `prefers-reduced-motion`; the text
  list remains as the accessible description.
- **Undo/redo.** Every applied change — manual or proposed — becomes a
  reversible command (GoF Command pattern), giving undo/redo across the
  drafting session.
- **Follow-up moves as chips.** When the model sees further sensible
  moves (e.g. spreading two runs that ended up adjacent), it offers them
  as new quick-chat suggestions instead of bundling them into the first
  proposal; impact-aware ordering (long runs and hard intervals first)
  makes these suggestions genuinely coach-like.

### Non-Functional Requirements

- **NFR-001**: AI-assisted, not AI-dependent: every assisted interaction
  has a manual equivalent, and both code paths are test-covered (the model
  is injectable, so tests run without a browser model).
- **NFR-002**: The prototype is labelled as a prototype on the page and
  uses no real personal data (fake-door rules, software guidebook §5).
- **NFR-003**: Capability detection degrades gracefully across Prompt API
  versions (feature-detect per method; older Chrome lacks newer methods).

### Key Entities

- **TrainingSession**: id, day, title, discipline (swim | run | swimrun |
  strength | flexibility).
- **Week**: ordered list of sessions; rearranging produces a new week,
  the input is never mutated.
- **Move**: proposal element — session id, target day, reason. Evidence,
  not a change: only applying and confirming change the plan.
- **AssistAvailability**: absent | unavailable | downloadable |
  downloading | available.

## Review & Acceptance Checklist

- [x] No implementation details beyond the platform constraints that
      motivated the feature (Chrome's built-in model is the requirement
      under test, per ADR-0010 option E)
- [x] Requirements are testable and unambiguous
- [x] All mandatory sections completed
- [ ] Open question: should the "not offered in this browser" notice link
      to a download of Chrome, or is naming the requirement enough?

## Execution Status

- [x] User scenarios defined (BDD Given/When/Then per project convention)
- [x] Requirements generated (FR-001…FR-012, NFR-001…NFR-003)
- [x] Entities identified
- [x] Prototype implemented on `/training.html` (guidebook §7.5);
      FR-011/FR-012 enforced through the system prompt
- [ ] Iteration 2 (IST/SOLL model, clarification chips, in-grid diff,
      undo/redo, follow-up chips) not yet designed in detail
- [ ] Chat-style conversational layer over the schedule (relation to the
      chatbot's `ChatAgent`/AG-UI interface, issue #10) not yet designed
