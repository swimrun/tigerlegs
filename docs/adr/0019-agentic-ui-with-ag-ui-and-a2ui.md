# 19. Agentic UI: AG-UI as the transport, A2UI as the candidate for generative UI

Date: 2026-11-13

## 1. Status

Draft. AG-UI is already in the code as an adapter; the use of A2UI is a candidate to be decided after a look at its catalog and its renderer for React. Issue #128.

## 2. Context

The chat of TigerLegs is a text conversation with chips. We want the assistant to show interactive elements next to its text (a proposal with an Apply button, a day picker, a preview of the week), and to call tools such as "make Wednesday a rest day" (issue #86). Two open protocols cover this, and they do different things:

- **AG-UI**: "an **open**, **lightweight**, **event-based** protocol that standardizes how AI agents connect to user-facing applications" (AG-UI, n.d.). It sits in a stack next to MCP ("Agent ↔ Tools & Data") and A2A ("Agent ↔ Agent") as the "Agent ↔ User Interaction" layer (AG-UI, n.d.).
- **A2UI**: "an open-source project, complete with a format optimized for representing updateable, agent-generated UIs and an initial set of renderers" (Google A2UI Team, 2025). The client "maintains a 'catalog' of trusted, pre-approved UI components (e.g., `Card`, `Button`, `TextField`), and the agent can only request to render components from that catalog", so the agent sends data and not code. The format "is currently at `v0.8`" and the project is Apache 2 licensed (Google A2UI Team, 2025).
- Together: "AG-UI handles the structured communication between client and agent, while A2UI transports the UI-specific content", by "transmitting the A2UI messages inside an AG-UI message of type `ACTIVITY_SNAPSHOT`" (Steyer, 2026). The documentation of AG-UI states it plainly: "A2UI is a generative UI specification - allowing agents to deliver UI widgets, where AG-UI is the Agent↔User Interaction protocol" (AG-UI, n.d.).

Steyer's book on agentic UI in Angular builds on both for Angular; this project uses React, which the Software (and Robotics) Engineering department teaches, and Redux for state may follow. The protocols are not tied to a framework: "individual components don't need to know either AG-UI or A2UI in detail" (Steyer, 2026), because a renderer sits between them and the components.

## 3. Options

| Option             | What it is                                                                                           | For                                                                               | Against                                                                        |
| ------------------ | ---------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------- | ------------------------------------------------------------------------------ |
| A. Own events only | `ChatEvent` as today                                                                                 | Simplest; no dependency                                                           | Every new kind of message is our own format; no other client or agent can join |
| B. AG-UI only      | The adapter of `src/client/ag-ui.ts` becomes the transport; chips and interfaces as CUSTOM events    | Open standard for events, tool calls and state; a remote agent can replace ours   | Interfaces would be our own format on top (CUSTOM events)                      |
| C. AG-UI and A2UI  | AG-UI as the transport; A2UI messages inside `ACTIVITY_SNAPSHOT` events; a catalog of our components | Declarative interfaces without agent code, a standard format, safe by the catalog | A2UI is at v0.8; a React renderer has to be checked; one more concept to teach |

## 4. Decision

Option B now, option C when its criteria are met. The adapter exists and has tests (`test/client/ag-ui.test.ts`); the tool calls of issue #86 go over AG-UI (`TOOL_CALL_START`, `TOOL_CALL_ARGS`, `TOOL_CALL_END`, `TOOL_CALL_RESULT`). A2UI is taken up for the interfaces of issue #128 when:

1. the format has left the v0.x versions, or it has proven stable enough for our catalog in a short check (not a build-off of both stacks);
2. a renderer for React exists or is small enough to write, with a catalog of our own components (Button, Chip list, Day picker, Week preview);
3. a screen reader and the keyboard can operate what it renders (the accessibility principle of the guidebook).

**The first component of the catalog is `ChangeProposal`** (chosen on 15 November 2026): a proposal that the assistant makes, as a small interface with a title, a list of changes (`label`, `before`, `after`) and the actions Apply and Dismiss.

- **There is one renderer, and each page has its own UI catalog**, composed of a shared base and the components of that page (decided on 15 November 2026, in the spirit of interface segregation: a page should not depend on components that it does not use). The training page can add a week preview, and the extractor page a highlight of a segment on the map (`src/client/highlight-controller.ts`). A component outside the catalog of the page is ignored, so the assistant of the FAQ cannot ask for an upload. The word *catalog* is always qualified: the UI catalog is not the FAQ catalog.
- **`ChangeProposal` lives in the base, so its name and properties are neutral on purpose.** It stays useful where there is no canvas to preview a change on, for example for a track edit on the extractor page (issue #109). A `TrainingWeekProposalCard` would pull sessions, week types and blocks into the base; the training agent turns a changed planned session into a change instead, and the renderer knows nothing about training.
- **Open: a proposal in place.** The training page may show a proposal as ghost cards in the week, with a dashed border and the text "proposed" (a border alone is not a signal), operable by keyboard as well. That is a component of the training catalog and is not decided. Undo and redo of what was applied, with a command for each change (the Command pattern), is a separate decision about the state of the week.
- **It is not a micro front end.** The page stays one Astro site with React islands, built and deployed once ([ADR-0008](./0008-astro-static-site-with-react-islands.md)). The catalog is a module in it, not an app of its own.
- **The agent sends data, not code.** "The agent generates a declarative JSON description of a component. The frontend maps this JSON to a pre-built, native widget", and "No code is executed" (Huang & Habler, 2025).
- **The behaviour follows the criteria of issue #128.** A component name that is not in the catalog is ignored and the text is shown. A description that is not valid gets a sentence in the chat, and the conversation continues. The labels of Apply and Dismiss come from the string files of the page and not from the agent, and the buttons work with the keyboard and a screen reader.
- **The first version uses our own simple property format**, with A2UI's names where they fit. Whether the format follows A2UI is decided when the criteria above are met.

## 5. Consequences

- The agents of the page stay replaceable: an AG-UI agent on a back end can take the place of the rule-based agent, without a change of the components.
- The catalog is ours, so the agent can only ask for components that we approve and that we make accessible.
- Documentation and code share the same words: the event names of the protocol appear in the guidebook, in the code and in the issues.
- Revisit when A2UI has a stable version, when a React renderer exists, or when AG-UI changes its event types.

## References

- AG-UI. (n.d.). *AG-UI overview*. Retrieved November 13, 2026, from https://docs.ag-ui.com/introduction
- Google A2UI Team. (2025, December 15). *Introducing A2UI: An open project for agent-driven interfaces*. Google Developers Blog. https://developers.googleblog.com/introducing-a2ui-an-open-project-for-agent-driven-interfaces/
- Huang, K., & Habler, I. (2025, December 29). *AG-UI and A2UI protocols explained: Building production-ready agentic systems with MAESTRO security*. Agentic AI. https://kenhuangus.substack.com/p/ag-ui-and-a2ui-protocols-explained
- Steyer, M. (2026, May 1). *Integrating A2UI with AG-UI and CopilotKit in Angular*. Angular Architects. https://www.angulararchitects.io/en/blog/integrating-a2ui-with-ag-ui-in-angular/
