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

See [docs/DEFINITION_OF_DONE.md](../blob/main/docs/DEFINITION_OF_DONE.md).

- [ ] Acceptance criteria met
- [ ] Tests added; `npm test` and `deno task build` pass
- [ ] Software guidebook updated in the same commit
- [ ] README / About page updated if user-visible behaviour or privacy changes
- [ ] ADR written if a significant design choice was made
- [ ] Privacy check (no trackpoints leave the browser; new storage or analytics documented)
- [ ] Accessibility check (keyboard, labels)
- [ ] Prototype features are labelled as such
- [ ] No scratch files committed; commit message has the issue number
