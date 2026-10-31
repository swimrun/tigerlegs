# 8. Astro Static Site with a React Frontend

Date: 2026-11-01

## Status

Proposed. No Astro migration has been implemented or authorised by this record.

## Context

TigerLegs currently builds static HTML, CSS and browser JavaScript with Deno tasks. The extractor, About page and generated Markdown guidebook share visual conventions, but their page shells are maintained separately (see `public/index.html`, `public/about.html` and `src/build-docs.ts`). The requested direction is one consistent layout and navigation, with directly linkable pages rather than a different menu on every page.

The website is deployed under `https://swimrun.group/tigerlegs/` on GitHub Pages. GPX parsing and analysis must remain browser-local; terrain requests remain opt-in. A frontend framework must not introduce GPX uploads, require a production application server, or move analysis into build-time rendering.

This choice concerns site composition and routing, not the analysis algorithms. The Deno analysis modules, tests and Web Worker remain independent of the site framework. Accounts, authentication and online route storage are separate future decisions, not reasons to add a backend now.

The project owner explicitly requires a **React-based interactive frontend**, not merely the possibility of adding React later. Astro itself is not React-based: it is the proposed static page framework, with React providing the extractor UI. Static prose can remain Markdown and Astro templates; this does not mean replacing React with Astro for application state and interaction.

## Research method: Multi-criteria decision making

Use the **Multi-criteria decision making** workshop method from ICT Research Methods. Its stated purpose is to "Improve the quality of complex decisions"; its ingredients include "Reliable information about the different alternatives" and "A lack of prejudice" (ICT Research Methods, n.d.).

The method calls for investigating alternatives, criteria and their weights, involving relevant stakeholders, and iterating the evaluation. We apply it with hard constraints followed by a weighted decision matrix. The weighted-sum formula below is our implementation of the method, not a formula prescribed by that website.

The criteria derive from the project owner's requests for consistent styling, static Pages hosting, directly linkable HTML pages and a React-based interactive frontend. **Weights and scores are provisional architectural judgments**, not measurements or stakeholder-approved results. The project owner and maintainers should review them before accepting this ADR; primary-source documentation supports capabilities, but does not establish migration cost or actual performance.

### Hard constraints

An eligible implementation must:

1. Deploy as static assets on GitHub Pages, with no runtime SSR or application backend.
2. Produce HTML for every public page, so direct navigation and reload do not depend on a client-side router or a custom 404 fallback.
3. Preserve the `/tigerlegs/` base path, existing public URLs and chapter fragment links.
4. Preserve browser-local GPX processing and explicit consent for terrain requests.
5. Implement the interactive extractor in React: upload/drop, track selection, strategy controls, analysis status, map/table presentation and linked selection.

These constraints are not tradeable against a higher weighted score.

## Alternatives

### A. Keep the existing Deno static build

Keep the current HTML pages and Markdown renderer, extracting a shared template where necessary. This has the lowest immediate migration risk and retains the existing toolchain. It meets the static hosting constraints but, unchanged, fails the React frontend requirement. Adding a React build and UI migration would be a different variant requiring evaluation. It is the baseline, not a deliberately weak alternative.

### B. Astro static output with a React extractor

Use Astro for build-time HTML pages, shared layouts and Markdown content, with its React integration for the interactive frontend. Build the extractor as a coordinated React application mounted in an Astro page. Reuse the existing pure TypeScript analysis modules and Web Worker; integrate Leaflet through a React component with explicit mount/update/unmount lifecycle management.

Astro documents static, prerendered deployment to GitHub Pages (Astro, n.d.-a). Its islands documentation states: "Astro components are the building blocks of your page template. They render to static HTML with no client-side runtime" and lists React among supported UI frameworks (Astro, n.d.-b).

This matches a documentation-heavy site with one interactive analysis page. Astro is not a React-only SPA. Migrating the UI to React is required by this proposal, but rewriting the analysis algorithms is not. Browser-dependent map and Worker setup must run on the client, not during static rendering.

### C. Next.js static export

Use Next.js with `output: 'export'`. This is a valid static-hosting alternative: "When running `next build`, Next.js generates an HTML file per route" (Vercel, n.d.).

Rejecting Next.js because it cannot run on Pages would be incorrect. The constraint is that runtime server features cannot be used in the exported site. Next.js offers a React-centred route model and a possible later server deployment, but that future capability is not currently required; maintainers would need to enforce static-export restrictions.

### D. Vite + React SPA

Use Vite to build a React app with shared components and a browser router. Vite documents static deployment and GitHub Pages base-path configuration (Vite, n.d.).

The plain SPA variant does **not** meet the per-page HTML constraint. Hash routing makes client routes addressable but does not generate separate HTML pages; a 404 fallback is not equivalent to native static routing. A prerendering or multipage layer could make this option eligible, but would require a separate design and evaluation. Its score below is diagnostic only and does not make the plain SPA eligible.

### E. Eleventy with browser TypeScript

Use a static-site generator for page templates and documentation, keeping the extractor as browser JavaScript. Eleventy provides a JavaScript-based static-site build alternative (Eleventy, n.d.).

This is a credible content-first option with shared templates, but the browser-TypeScript variant fails the React frontend requirement. Adding React would require additional build integration and a UI migration, with a new evaluation of that variant.

## Provisional decision matrix

Scores: **1 = weak fit, 3 = adequate fit, 5 = strong fit**. Intermediate scores express relative fit. All scores concern the proposed configurations above, not universal rankings of frameworks.

Weighted score = `sum(weight percent * score) / 100`, on a 1–5 scale.

| Criterion | Weight | A: Deno | B: Astro | C: Next export | D: Vite SPA | E: Eleventy |
| --- | --- | --- | --- | --- | --- | --- |
| Static hosting and native per-page routing | 25% | 5 | 5 | 5 | 2 | 5 |
| Shared layouts and Markdown documentation | 20% | 3 | 5 | 5 | 2 | 5 |
| Selective interactivity without site-wide React hydration | 20% | 2 | 5 | 3 | 4 | 2 |
| Migration simplicity and existing-toolchain fit | 15% | 5 | 2 | 2 | 3 | 3 |
| Documentation-first maintainability | 10% | 3 | 5 | 4 | 2 | 4 |
| React integration and interactive UI | 10% | 1 | 5 | 5 | 5 | 1 |
| **Weighted score** | **100%** | **3.40** | **4.55** | **4.05** | **2.85** | **3.60** |
| **Hard constraints satisfied by this variant?** | | **No** | Yes | Yes | **No** | **No** |

Vite's hosting/routing score reflects static hosting without native per-page HTML in the SPA variant; its hard-constraint failure excludes it regardless of the weighted sum.

Astro's lead comes from native static page composition and selective interactivity with a React application. Next.js static export is the other eligible variant and is React-centred throughout. Deno and Eleventy remain useful baselines, but their evaluated variants cannot satisfy the owner's React requirement. Migration and maintainability scores are estimates pending a small prototype, not benchmark findings.

**Sensitivity check:** if avoiding migration becomes the dominant priority, moving 20 percentage points to migration simplicity (35%) from shared layouts (10%) and selective interactivity (10%) changes Deno's score to **3.90** and Astro's to **3.95**; Deno remains ineligible without a React migration. Among eligible variants, moving 15 percentage points from selective interactivity (5%) to React integration (25%) reduces Astro's lead over Next.js from **0.50** to **0.20**. These overlapping criteria should also be reviewed for double counting; a demand for React-based page composition throughout, rather than only the interactive application, would warrant revisiting the choice.

## Proposed decision

Prefer **B: Astro static output with a React-based interactive frontend**, subject to stakeholder review and a successful migration prototype.

Use a shared Astro layout for the extractor, About page, guidebook and ADR pages. Generate real HTML routes at build time. React is mandatory for the extractor UI, not optional future work. Static navigation and documentation can remain Astro/Markdown without client hydration.

Use ordinary static navigation initially. SPA-like navigation is optional later and must preserve direct links, accessibility and browser history. On GitHub Pages there is no backend router to align: the build's route-to-file mapping must match the public links. Any later API routing belongs to a separate backend decision.

## Consequences and acceptance evidence

- Add a site-build toolchain and dependencies during migration; retain Deno for analysis tests and existing non-site tasks. The exact package manager and build orchestration remain implementation decisions.
- Keep map/table/selection coordination intact. Do not split tightly coupled extractor state across islands merely to use the framework.
- Acceptance requires the extractor's interactive UI to be React-based, with lifecycle cleanup for Leaflet, Workers and pending requests. Keeping the imperative app unchanged inside an Astro shell is only an intermediate migration step, not completion.
- Configure the deployed site and `/tigerlegs/` base path, including sample downloads, images, diagram assets and the module Worker URL (Astro, n.d.-a).
- Preserve `index.html`, `about.html`, `guidebook.html` and guidebook heading IDs, or provide actual static compatibility pages. Do not rely on server redirects unavailable on Pages.
- Publish ADR HTML pages with the shared layout and working guidebook links; the current guidebook renderer strips repository-relative Markdown links, so adding an ADR to its source index alone does not publish that ADR.
- Verify direct navigation and reload for every route on a plain static server and a Pages preview. Documentation remains readable without JavaScript; interactive analysis still requires JavaScript.
- Verify mobile and desktop navigation, keyboard behaviour, analysis/Worker equivalence and no GPX upload. Do not fetch terrain during a build or without user consent.
- Compare emitted JavaScript and build complexity with the current baseline before acceptance. Do not claim bundle-size, responsiveness or battery improvements without measurement.

Until that evidence exists, keep the current deployment and this ADR's **Proposed** status. This record neither implements migration nor supersedes the browser-local analysis decision in [ADR-0003](./0003-gpx-analysis-execution-location.md).

## References

Astro. (n.d.-a). *Deploy your Astro site to GitHub Pages*. https://docs.astro.build/en/guides/deploy/github/

Astro. (n.d.-b). *Islands architecture*. https://docs.astro.build/en/concepts/islands/

Eleventy. (n.d.). *Get started*. https://www.11ty.dev/docs/

ICT Research Methods. (n.d.). *Multi-criteria decision making*. https://ictresearchmethods.nl/workshop/multi-criteria-decision-making/

Vercel. (n.d.). *How to create a static export of your Next.js application*. https://nextjs.org/docs/app/guides/static-exports

Vite. (n.d.). *Deploying a static site*. https://vite.dev/guide/static-deploy.html
