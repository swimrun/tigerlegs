# 11. Model lifecycle feedback and think thread for on-device chat

Date: 2026-11-10

## 1. Status

Draft. No decision has been taken; this record collects concepts and open questions. It extends option E of [ADR-0010](./0010-tigerlegs-mcp-server-and-strava-integration.md) (on-device Gemini Nano via the Prompt API). The first prototype of Part 1 exists in the shared chat (`training-agent.ts`); Part 2 is not implemented.

## 2. Context

Using the chat prototype, the user saw "downloading model" and no spinner after typing a prompt. That observation mixes two different waits that have different causes, different durations and different design answers. This ADR keeps them apart:

| | **Part 1: model lifecycle** | **Part 2: think thread** |
| --- | --- | --- |
| When | Once per browser profile (and on model updates) | On every prompt |
| What happens | Chrome downloads Gemini Nano (`downloadprogress`) | The model generates text (`promptStreaming()`) |
| Duration | Minutes; multi-GB | Seconds |
| Needs consent | Yes: a large opt-in download | No |
| User question answered | "What is being installed and why does it need so much space?" | "Is it doing something, and what?" |
| Design answer | Explicit state with size disclosure and progress | Waiting feedback, possibly a reasoning trace |

The two must not share one status line: a download progress message shown as the answer to a prompt makes the chat look broken, and a "thinking" animation during a download hides that a multi-GB transfer is happening.

## 3. Part 1: model lifecycle

States come from `LanguageModel.availability()`: `unavailable`, `downloadable`, `downloading`, `available` (plus `absent` when the API does not exist).

- **`downloadable`:** never download as a side effect of a prompt without asking. Explain, offer an explicit "Install Gemini Nano" action, then show progress.
- **`downloading`:** show progress as a status, separate from any generation feedback.
- **`unavailable` / `absent`:** say why (browser, hardware, language) and point to the manual path. Language and browser hints are in `chat-hints.ts`.

### 3.1 Size disclosure

Show a short, expandable note next to the install action:

- What is downloaded: the Gemini Nano model, roughly 4 GB (secondary reports; verify the current size on a clean profile).
- Why more space is needed: Chrome's documentation lists a minimum of about 22 GB free disk space for on-device models (Chrome for Developers, n.d.), well above the model file itself. Reports of ~30 GB come from community posts and are not treated as a requirement.
- Per Chrome channel: Chrome and Canary each keep their own copy (observed, ADR-0010).
- Optional and removable: the app works without it.

Figures change between releases; copy states the documented requirement, not the anecdote, and is checked against the Chrome documentation at implementation time.

## 4. Part 2: think thread

### 4.1 Can Gemini Nano think?

Not natively. The Prompt API streams plain text and has no separate reasoning channel. Gemini's documented "thinking" (Google, n.d.) is a feature of the cloud Gemini API models and is not exposed on device. A think thread is therefore either *synthetic* (prompted) or *fake* (UI only).

### 4.2 Options

| Option | What it is | For | Against |
| --- | --- | --- | --- |
| **A. Decorative status (fake)** | Rotating, domain-flavoured phrases while generating ("Pondering… looking for the session to move…") not tied to model output | Trivial, no prompt changes, no token cost; fits the brand tone | Not real; can mislead if presented as reasoning |
| **B. Generation-phase status** | Honest states from real events: session created → first token → streaming → done | Observable, no false claims | Says nothing about the content |
| **C. Synthetic chain of thought** | Prompt asks for `<reasoning>…</reasoning>` before the answer; the UI parses the cumulative stream and routes tagged text to a collapsible panel | Real content; may improve a small model's output; shows how the system prompt steers it | May break tags; costs tokens and latency; generated text is not a faithful trace |
| **D. Plan → act → reflect** | Separate sessions (or `clone()`) for planning, validation and final generation; the plan becomes a visible checklist | Structured and testable; schema output fits propose-confirm-sync | Several calls per prompt; latency and memory on a small model |

Working hypothesis, to validate: **B** with **A** phrases as decoration inside it, and **C** as an experiment on week rearranging. D is parked until a task needs multi-step plans. Anything shown must be labelled so decoration cannot be mistaken for the model's own reasoning.

### 4.3 Constraints for C

- The streamed text is cumulative; the parser must be deterministic and tolerant of unclosed or malformed tags, falling back to showing everything as the answer.
- The reasoning panel is collapsed by default and never applied to the schedule; only schema-validated output is applied, after user confirmation (evidence rule from ADR-0010).
- Output languages are limited to what Nano supports (en, de, fr, es, ja); the site's Dutch falls back as described in ADR-0010.
- Thought text may contain training data; it stays on device like all Nano I/O.

## 5. Decision

None yet.

## 6. Consequences and validation

- Part 1: verify the `downloadable` → `downloading` → `available` transitions and that no prompt triggers a download unasked. Prototype exists in the shared chat; validate on a clean Chrome profile.
- Part 2: prompt Nano with a `<reasoning>` contract on 10–20 real week-rearranging requests; measure tag compliance, latency and answer quality against the same prompts without it.
- Test coverage for both paths, with and without the Prompt API, and with malformed tags.
- Accessibility: status changes announced via a polite live region; animation respects `prefers-reduced-motion`.
- Revisit when the chat moves beyond the prototype; then record a real decision with alternatives weighed per ADR-0008/0009. Part 1 and Part 2 may then become two ADRs if their decisions diverge.

## References

- Chrome for Developers. (n.d.). *Get started with built-in AI*. https://developer.chrome.com/docs/ai/get-started
- Google. (n.d.). *Gemini thinking*. Google AI Studio. https://aistudio.google.com/docs/thinking
