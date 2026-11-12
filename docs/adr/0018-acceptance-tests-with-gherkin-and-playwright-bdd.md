# 18. Acceptance tests with Gherkin and playwright-bdd

Date: 2026-11-11

## 1. Status

Accepted, as a pilot on issue #92 (Extractor: map above the fold, optional sample menu, variants in a dropdown and a compact terrain option).

## 2. Context

Each issue states its acceptance criteria as Given, When, Then lines. Until now the matching tests were hand-written Playwright specs in `test/site/`, and nothing tied a criterion to a test. The question was whether to use Cucumber.js, or Storybook play functions.

## 3. Decision

Page-level criteria are written as Gherkin `.feature` files in `test/features/`, with the wording of the issue, and run with [playwright-bdd](https://github.com/vitalets/playwright-bdd). Its README says it converts Gherkin features into Playwright specs, so the Playwright runner stays in control, with one configuration and the same browser setup.
Step definitions live in `test/features/steps/`. `npm run test:features` runs `bddgen` (which writes the specs to `test/features/.generated/`, which Git ignores) and then Playwright.

Component-level criteria stay Storybook play functions, with `step("Given …")` labels; logic criteria stay Vitest unit tests.

## 4. Consequences

- Positive: each criterion of an issue can be traced to a scenario with the same words; one runner for acceptance and end-to-end tests.
- Negative: one more dev dependency, a generator step, and step definitions to maintain.
- Not chosen: raw Cucumber.js, which brings a second runner and a second browser setup.
- Revisit when the pilot shows that the steps are not reused, or when playwright-bdd is no longer maintained.
