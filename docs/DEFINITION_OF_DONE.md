# Definition of Done

A change is done when every applicable item below is true.
GitHub issues and pull requests carry this list as checkboxes
(see `.github/ISSUE_TEMPLATE/user-story.md` and `.github/pull_request_template.md`); `test/definition-of-done.test.ts` fails when they list other items than this document.
Tick only what is verified; write "n/a" with a reason for the rest.

## Checklist

- [ ] **Acceptance criteria met.** Each Given/When/Then of the issue is demonstrably true.
- [ ] **Tests.** New behaviour has a test (property-based for domain logic, Gherkin features and Playwright for site behaviour).
      `npm test` passes, and so do `npm run test:site` and `npm run test:features` for site changes.
- [ ] **Build.** `npm run build` passes (needs Node 24 or newer for Astro).
- [ ] **Software guidebook updated** in the same commit: the principle (chapter 5), the code section (chapter 7), the glossary or the data section, whichever the change touches.
- [ ] **README and About page updated** when user-visible behaviour or the privacy statement changes.
- [ ] **ADR written** when a significant design choice was made or reversed.
- [ ] **Privacy check.** No trackpoints leave the browser. Any new storage, network call or analytics is opt-in or cookieless, and the privacy principle in chapter 5 is updated.
- [ ] **Accessibility check.** Usable by keyboard, controls have text labels, and colour or flags are never the only signal.
- [ ] **Prototype labelled.** A fake or unfinished feature says so in the interface ("Fake it till you make it").
- [ ] **Repository hygiene.** No temporary or generated scratch files committed; images in `src/assets/` (shown on a page) or `public/img/` (fixed URL), fixtures in `test/fixtures/`.
- [ ] **Commit message** is in English, imperative mood, with the issue number in the title (see `AGENTS.md`).

## Rules for creating issues

- Issues, not files in the repository, hold task descriptions and requirements discussion.
  After implementation the software guidebook is the lasting description.
- Create issues from the user story template, including by agents:
  `gh issue create --template user-story.md`, or the same sections in the body.
- Do not delete the Definition of Done section of an issue.
