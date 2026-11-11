# 12. Persistent chat across pages

Date: 2026-11-10

## 1. Status

Proposed: option B, after a successful spike (issue #22). It builds on [ADR-0008](./0008-astro-static-site-with-react-islands.md) (Astro static site with React islands).

## 2. Context

The chat is one shared React component ([Chatbot.tsx](../../src/components/Chatbot.tsx)) behind a `ChatAgent` boundary: an FAQ agent on the Transformerrr page, a training agent on the Training page. Two wishes follow from that:

- The chat sits in the same place on every page (fixed, bottom right) and keeps its conversation when the user navigates.
- URLs stay real paths (`/`, `/about`, `/training`), never `#` anchors, and a direct visit to any of them works on GitHub Pages.

Today every page is its own static HTML document with its own chat island, so navigating throws the conversation away. The two agents also differ in what they need: the FAQ agent needs a language, the training agent needs the current training week, which lives in the `TrainingWeek` island.

Constraints: GitHub Pages serves static files only and has no rewrite rules; a missing path returns `404.html` with a 404 status. Issue #15 wants one real URL per language for SEO. The site follows "AI-assisted, not AI-dependent" and keeps working without JavaScript where it can.

## 3. Options

| Option | How it works | For | Against |
| --- | --- | --- | --- |
| **A. Keep multi-page, chat per page** (status quo) | Each page mounts its own chat | Simplest; no JS routing; every URL is a real file | Conversation lost on navigation; chat position must be kept in sync by convention |
| **B. Astro view transitions with a persisted island** | Add Astro's `ClientRouter` to the layout and mark the chat island `transition:persist`. Navigation swaps page content in place; the chat island and its state survive. A small shared store (e.g. nanostores, as the Astro docs suggest for sharing state between islands) tells the chat which agent applies on the current page | Real URLs and real HTML per page, so direct links, GitHub Pages and SEO keep working; progressive enhancement (without JS it is a normal link); small change inside the current Astro setup | Persisting island state across swaps has edge cases (scripts re-running, page-specific islands unmounting); the agent hand-off needs the shared store; view-transition behaviour in older browsers falls back to full page loads |
| **C. React Router single-page app** | One HTML shell, client-side routes | Chat is trivially permanent; full control of transitions | GitHub Pages has no rewrites: direct links need a `404.html` copy of the shell, which answers real pages with a 404 status; weaker SEO and conflicts with #15; gives up Astro's static HTML per page (ADR-0008) |
| **D. Restore the chat from `sessionStorage` on each page load** | Pages stay independent; the chat saves and reloads its messages | No router, no Astro changes | Visible reload flicker; the training agent's pending proposal cannot be restored; stores conversation text in the browser |

## 4. Decision

Option **B**: Astro `ClientRouter` in the layout, the chat as one `transition:persist` island in the layout, and a small module-level store (`chat-store.ts`) through which the page-specific island registers its agent. A plain module store replaces nanostores: all islands on a page share one module instance, so no dependency is needed.

Spike findings (all Playwright site tests pass, plus a new test that navigates `/` → `/training` → `/about` with the chat open):

- The conversation survives navigation; the document is not reloaded; URLs stay `/`, `/training.html`, `/about.html`.
- The training agent takes over on `/training` and withdraws when the page unmounts; chips from another agent are dropped on a switch.
- Astro replaces the `<html>` attributes on a swap, which reset `lang` to `en` and would have reset the chat. A `astro:before-swap` handler copies the chosen language into the incoming document.
- Bundled and inline module scripts run only once per page load, so three scripts needed work: the language switch and the About page script now bind on `astro:page-load`, and the Guidebook's Mermaid script uses `data-astro-rerun` and `mermaid.run()` (`startOnLoad` never fires after a swap).

## 5. Consequences and validation

- Any new page script must bind on `astro:page-load` (or use `data-astro-rerun`); a plain module script runs only on the first page that includes it.
- Verify direct visits and reloads of every route on GitHub Pages, and keyboard and screen-reader behaviour of the persisted chat (focus must not be lost on navigation).
- Check that the Playwright site tests and the Storybook accessibility run still pass.
- Not yet verified: focus and screen-reader behaviour of the persisted chat across navigation, and the deployed GitHub Pages site.
- Revisit when issue #15 (URL per language) is scheduled, since routing and language URLs interact.

## References

- Astro. (n.d.). *View transitions*. https://docs.astro.build/en/guides/view-transitions/
- Astro. (n.d.). *Share state between islands*. https://docs.astro.build/en/recipes/sharing-state-islands/
- GitHub. (n.d.). *Creating a custom 404 page for your GitHub Pages site*. https://docs.github.com/en/pages/getting-started-with-github-pages/creating-a-custom-404-page-for-your-github-pages-site
