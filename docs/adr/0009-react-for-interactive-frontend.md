# 9. React for the Interactive Frontend

Date: 2026-11-01

## 1. Status

Accepted. Implemented alongside the Astro migration in [ADR-0008](./0008-astro-static-site-with-react-islands.md); deployment remains subject to PR review and validation.

## 2. Context

The project owner wants a React-based frontend, building on existing familiarity and learning React more deeply. The owner considers React simpler to work with than Vue and Angular. This is a project-specific preference and learning objective, not evidence that React is universally simpler or technically superior.

The interactive extractor needs coordinated upload/drop handling, track selection, strategy controls, analysis status, a Leaflet map, a segment table and linked selection. Before migration these behaviours existed in an imperative browser TypeScript entry point. They now live in `src/components/Extractor.tsx`, `CourseMap.tsx` and `SegmentTable.tsx`. The analysis modules and Web Worker remain reusable independently of the UI framework (see `src/client/analyze.ts` and `src/client/worker-client.ts`).

We separate two decisions:

- **UI framework:** React, Vue, Angular or another component model; decided here.
- **Static page composition and deployment:** Astro versus other site frameworks; proposed in ADR-0008.

Choosing React does not itself choose Astro, require an SPA, or introduce a backend.

## 3. Evaluation method

Apply the [ICT Research Methods multi-criteria decision making method](https://ictresearchmethods.nl/workshop/multi-criteria-decision-making/), which calls for investigating alternatives, criteria and weights and involving stakeholders (ICT Research Methods, n.d.). Here the project owner's familiarity and learning objective are the primary criteria; static deployment compatibility, integration effort and preservation of existing analysis are also relevant.

This is a qualitative comparison rather than an invented numerical benchmark. We do not first require React and then use that requirement to prove React wins. Documentation supports integration capabilities; relative learning effort is the owner's stated judgment, and migration effort remains unmeasured.

## 4. Alternatives and project-specific trade-offs

| Option | Reasons to consider | Reasons not to choose here |
| --- | --- | --- |
| **React** | Matches the owner's familiarity and learning goal; official Astro integration; documented Effects model for synchronising with external systems such as an imperative map | Requires careful state design and lifecycle cleanup; familiarity does not eliminate migration work |
| **Vue** | Official Astro integration; single-file components colocate template, logic and styling | No identified project requirement makes its component model preferable to the owner's React experience |
| **Angular** | A valid frontend alternative with deployment tooling; worth reconsidering if future maintainers prefer its conventions | Angular integration is community-maintained in Astro's directory rather than one of its listed official integrations; introduces a different framework to learn without a demonstrated project benefit |
| **Preact or Svelte** | Both have official Astro integrations; credible options if a prototype demonstrates a material benefit | No measured bundle, responsiveness or maintainability problem currently justifies diverging from the explicit React learning goal |
| **Keep browser TypeScript** | Avoids a UI migration and preserves working behaviour | Does not meet the owner's desired component-based React direction; remains the implementation until migration is undertaken |

Astro lists React, Vue, Preact and Svelte among its official integrations, and Angular among community-maintained integrations (Astro, n.d.). Vue documents single-file components that encapsulate template, logic and styling (Vue.js, n.d.). Angular documents deployment tooling (Angular, n.d.). These are capability observations, not claims that any framework cannot host a static frontend.

### 4.1 Do Astro, GitHub Pages or Deno favour something other than React?

- **Astro:** no blocker. It officially integrates React and Vue. Its framework components can render static HTML or hydrate on the client, allowing a React extractor inside static documentation pages (Astro, n.d.).
- **GitHub Pages:** the static output and URL requirements belong to the build/routing design in ADR-0008, not React's component model. React does not inherently require runtime SSR or a backend. A plain client-router SPA still needs special handling for direct links, regardless of its UI framework.
- **Deno:** the existing pure TypeScript analysis and tests need not become React code. The site build toolchain must be validated separately; retaining Deno does not establish a technical preference for Vue or Angular. Do not assume every Astro/plugin build works under Deno without testing it.
- **Leaflet and Workers:** React documents Effects for synchronising components with external systems (React, n.d.). This provides a suitable integration mechanism, not a unique advantage over all alternatives. Map creation, listeners, Worker ownership and request cancellation still require explicit lifecycle management.

There is currently no demonstrated project-specific benefit that outweighs choosing the framework the owner knows and wants to learn. Reconsider if representative measurements or the future maintenance team provide contrary evidence.

## 5. Decision

Use **React with TypeScript for the interactive extractor frontend**.

Keep analysis, distance calculation and worker jobs in framework-independent TypeScript. React owns UI state and presentation; it does not redefine analysis behaviour or move GPX data off the device.

If Astro is accepted, use its React integration for one coordinated extractor application rather than independent islands for tightly coupled map/table state. Static documentation and page routing can remain Astro/Markdown. If another static page framework is chosen, the React decision can still stand.

## 6. Consequences and validation

- The UI migration must preserve existing behaviour, accessibility, translations, file warnings, strategy consent and linked map/table selection.
- Leaflet remains usable directly; adopting an additional React map wrapper is a separate implementation choice, not required by this ADR.
- Keep rendering pure. Use events for user actions and Effects where external-system synchronisation requires them, with cleanup on unmount and dependency changes (React, n.d.).
- Verify no duplicate map instances, leaked listeners or Workers, stale analysis updates, or unintended terrain requests.
- Continue running Deno analysis tests independently; add React interaction tests using tooling selected during migration.
- Do not add a global state library, router or component suite merely because React permits one.
- Compare a representative working prototype with the current UI before declaring migration complete. No speed, bundle-size or battery improvement is claimed here.

## References

- Angular. (n.d.). *Deployment*. https://angular.dev/tools/cli/deployment
- Astro. (n.d.). *UI frameworks*. https://docs.astro.build/en/guides/framework-components/
- ICT Research Methods. (n.d.). *Multi-criteria decision making*. https://ictresearchmethods.nl/workshop/multi-criteria-decision-making/
- React. (n.d.). *Synchronizing with Effects*. https://react.dev/learn/synchronizing-with-effects
- Vue.js. (n.d.). *Single-file components*. https://vuejs.org/guide/scaling-up/sfc.html
