---
name: User story
about: A feature or change, written as a user story with Given/When/Then criteria
title: ""
labels: ""
---

## User story

As a <role>, I want <goal>, so that <benefit>.

## Acceptance criteria (BDD)

- Given <context>, when <action>, then <outcome>.
- etc. GWT statements with all applicable happy paths
- and also acceptance criteria for relevant unhappy paths

## Notes

Background, constraints, links to ADRs or the guidebook.

## Definition of Done

See [docs/DEFINITION_OF_DONE.md](../blob/main/docs/DEFINITION_OF_DONE.md) for the details of each item. Tick only what is verified; write "n/a" with a reason for the rest.

- [ ] **Acceptance criteria met.** Each Given/When/Then of the issue is demonstrably true.
- [ ] **Tests.** New behaviour has a test; `npm test` passes, and so do `npm run test:site` and `npm run test:features` for site changes.
- [ ] **Build.** `deno task build` passes.
- [ ] **Software guidebook updated** in the same commit.
- [ ] **README and About page updated** when user-visible behaviour or the privacy statement changes.
- [ ] **ADR written** when a significant design choice was made or reversed.
- [ ] **Privacy check.** No trackpoints leave the browser; new storage, network calls or analytics are opt-in or cookieless and documented.
- [ ] **Accessibility check.** Usable by keyboard, controls have text labels, and colour or flags are never the only signal.
- [ ] **Prototype labelled.** A fake or unfinished feature says so in the interface.
- [ ] **Repository hygiene.** No temporary or generated scratch files committed; images, fixtures and data in the right folders.
- [ ] **Commit message** is in English, imperative mood, with the issue number in the title.
