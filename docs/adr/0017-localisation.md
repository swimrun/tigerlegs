# 17. Localisation: JSON files, one URL per language and an i18n library

Date: 2026-11-11

## Status

Draft. The owner has decided the format (translations are data: JSON files, not TypeScript) and wants an i18n framework; the routing, the loading and the library are to decide (issue #84).
Until then the per-language TypeScript files (`TrainingWeek.strings.<lang>.ts`, `chat.strings.<lang>.ts`) are a stopgap.

## Context

Today the language is a runtime choice in the browser:

- `<html lang="en">` is fixed in `SiteLayout.astro`, and a script overwrites it from `localStorage` or the browser language (`language-switch.ts`). The page that the server sends is always English.
- All four languages are in the page or the JavaScript at once: the dictionaries of the training page and the chat are in the bundle, and the About page carries both of its languages in the markup.
- There is one URL for every language, so a search engine only ever sees the English page and `hreflang` links are not possible.
- Translations are code: `Record<Lang, …>` dictionaries and TypeScript files with functions in them.

What we want:

| #   | Requirement                                                                                                  |
| --- | ------------------------------------------------------------------------------------------------------------ |
| R1  | Translations are data: external JSON files, one per language per feature, separate from code                 |
| R2  | Only the language of the page is loaded, so that adding languages does not grow what every visitor downloads |
| R3  | `<html lang>` is right in the HTML that is sent, not set afterwards by a script                              |
| R4  | One URL per language and page, for search engines, with `hreflang` links between them                        |
| R5  | The same library works in React islands and in plain TypeScript modules (the chat agents are not React)      |
| R6  | Variables and plurals are written in the JSON ("{count} sessions did not fit"), without functions            |
| R7  | A language file that misses a key fails a check                                                              |

## The three decisions

### 1. Routing: one URL per language (R3, R4)

Astro has built-in i18n routing: `locales` and `defaultLocale` in the configuration, translated pages in folders (`src/pages/fr/about.astro` gives `/fr/about/`, `src/pages/about.astro` the default language when `prefixDefaultLocale` is false), `Astro.currentLocale` in a page and `getRelativeLocaleUrl()` for links (Astro, n.d.).
Because the site is static, every page is built once per language, and `<html lang>` is written at build time.
The language switch becomes a list of links to the same page in the other languages, the `localStorage` choice and the script that rewrites `lang` disappear, and the layout adds `<link rel="alternate" hreflang="…">` for every language of the page.
Whether to redirect a first visit by browser language is open: it helps visitors but is not always good for search engines (to check).
The pages should not be copied per language: one page file with a locale parameter generates all languages (to check against the Astro documentation of dynamic routes).

### 2. Loading: only the language of the page (R1, R2, R6)

Each page is rendered for its language at build time, and the React islands receive only the messages of that language, as props or through the library's provider.
Adding a language then means a new set of JSON files and one entry in `locales`; nobody downloads it unless they read that language.
The files are `<feature>/strings/<lang>.json` once the folders follow the feature structure of #83, for example `training/strings/nl.json`.

### 3. The library

The choice of library is made with the multi-criteria method of ADR-0014, below.

## Method

The comparison follows the [ICT Research Methods multi-criteria decision making method](https://ictresearchmethods.nl/workshop/multi-criteria-decision-making/), as ADR-0009 and ADR-0014 did: alternatives, criteria and weights first, then each option judged per criterion, with time to iterate (ICT Research Methods, n.d.).
Scores run from 1 (poor) to 5 (excellent), weights add up to 100, and the total is the sum of weight times score.
The weights and the familiarity scores (C7) are the owner's to set; every other score is provisional and rests on search summaries and library documentation that have not been read in full ([Tolgee](https://tolgee.io/blog/react-i18n-libraries-comparison), [SimpleLocalize](https://simplelocalize.io/blog/posts/the-most-popular-react-localization-libraries/), [Locize](https://www.locize.com/blog/react-intl-vs-react-i18next), [Paraglide JS](https://github.com/opral/paraglide-js), [i18next-icu](https://github.com/i18next/i18next-icu)), so they must be checked, and the spike below is meant to do that.

## Alternatives

| Option                         | What it is                                                                                         |
| ------------------------------ | -------------------------------------------------------------------------------------------------- |
| **i18next + react-i18next**    | The core library with plugins and hooks for React; own message format, ICU through a plugin        |
| **react-intl (FormatJS)**      | ICU MessageFormat in JSON, messages passed to a provider; `intl-messageformat` works outside React |
| **Lingui**                     | Catalogs extracted from the code by macros at build time; ICU                                      |
| **Paraglide JS**               | JSON messages compiled to type-safe, tree-shakable functions; designed for islands                 |
| **Hand-made TypeScript files** | Dictionaries in code: today's stopgap                                                              |

Others exist (Tolgee, Intlayer, next-intl, which is for Next.js); they are left out because they are tied to a platform or a framework we do not use.

## Criteria and weights (draft)

| #   | Criterion                                 | Weight | What it asks                                                                         |
| --- | ----------------------------------------- | ------ | ------------------------------------------------------------------------------------ |
| C1  | Translations are JSON data                | 15     | External files, separate from code (R1)                                              |
| C2  | Only the active language is loaded        | 10     | Messages of one language per page, so more languages do not grow the download (R2)   |
| C3  | Plain TypeScript and React islands        | 15     | The same library in the React islands and in the chat agents (R5)                    |
| C4  | Variables and plurals in the data         | 10     | "{count} sessions did not fit" written in the JSON, without functions (R6)           |
| C5  | Type safety and completeness checks       | 10     | A missing key or a wrong variable fails a check (R7)                                 |
| C6  | Fit with Astro routing and a static build | 10     | Works at build time and with one URL per language (R3, R4)                           |
| C7  | Familiarity                               | 10     | How well the owner knows it or wants to learn it (the owner's to score)              |
| C8  | Ecosystem and long-term health            | 10     | Maintenance, community, documentation                                                |
| C9  | Autonomy                                  | 5      | Who owns it, and the licence (criterion C8 of ADR-0014); not yet looked up for these |
| C10 | Size on the page                          | 5      | What it adds to the JavaScript of a small site                                       |

## Evaluation (provisional)

| Option                     | C1 (15) | C2 (10) | C3 (15) | C4 (10) | C5 (10) | C6 (10) | C7 (10) | C8 (10) | C9 (5) | C10 (5) | Total   |
| -------------------------- | ------- | ------- | ------- | ------- | ------- | ------- | ------- | ------- | ------ | ------- | ------- |
| i18next + react-i18next    | 5       | 4       | 5       | 4       | 4       | 4       | 3       | 5       | 3      | 3       | **420** |
| Paraglide JS               | 5       | 3       | 5       | 3       | 5       | 4       | 3       | 3       | 3      | 5       | **400** |
| react-intl (FormatJS)      | 5       | 4       | 3       | 5       | 3       | 3       | 3       | 4       | 3      | 2       | **365** |
| Lingui                     | 4       | 4       | 3       | 5       | 5       | 2       | 3       | 3       | 3      | 5       | **365** |
| Hand-made TypeScript files | 1       | 2       | 5       | 1       | 4       | 3       | 5       | 2       | 5      | 5       | **310** |

How the scores were obtained: i18next works in plain JavaScript as well as React and keeps resources in JSON (C1, C3), has the largest community (about 3.5 million downloads a week, C8), needs a plugin for ICU (C4) and is about 6 KB with react-i18next (C10); react-intl is ICU native (C4) but about 20 KB (C10) and React first (C3); Lingui is about 2 KB with strong typing (C5, C10) but works through build-time macros whose fit with Astro is to check (C6); Paraglide compiles to typed functions that work anywhere (C3, C5) and is small (C10), but is newer (C8) and how it ships only one language per page is to check (C2); the hand-made files fail C1 and C4 by construction.
All C7 scores are my placeholder, 3 for every library and 5 for the files the project already uses.

### Reading the result

i18next leads with 420 against 400 for Paraglide JS, which is inside the margin of provisional scores, so a spike decides, as in ADR-0014.
The loading requirement (C2) does not decide between the libraries: every one of them can receive the messages of a single language, and decision 2 above does that work through routing.

## Sensitivity

- If the owner knows i18next well (C7 = 5 against 3 for the others) its lead grows to 440 against 400.
- If size and type safety weigh more (C5 and C10 at 15 each, C8 and C1 lowered), Paraglide JS and Lingui gain and Paraglide leads.
- If ICU everywhere is the first requirement (C4 at 20), react-intl and Lingui gain.
- If autonomy (C9) turns out to differ between the projects, the owners of each need to be looked up first: not done.

## Spike

Migrate the training page texts to JSON with i18next (with `i18next-icu`) and with Paraglide JS, on the Astro i18n routes of decision 1, and compare: the JavaScript added to the page, whether only the page's language is shipped, how plurals and variables read in the JSON, whether a missing key fails a check, and how the chat agents (plain TypeScript) use each. Record the results in this ADR.

## Consequences and migration

1. Add the `i18n` configuration, move the pages to locale routes, set `<html lang>` and the `hreflang` links in the layout, and turn the language select into links. Playwright checks that every language URL has the right `lang` and alternates.
2. Add the library, move the training and chat texts from the stopgap TypeScript files into JSON, and replace the functions (`movedFromTo`, `notPlaced`) by messages with variables and plurals.
3. Give the About page its content per language (now both languages are in one file), and the extractor page its first translation (it is English only).
4. Remove `language-switch.ts` and the `MutationObserver` on `lang`; keep the FAQ JSON, which already is per language.
5. Replace the guard test on `*.strings.<lang>.ts` by a test that every language file has the same keys (R7).

## Open questions

1. Is the default language at the root (`/tigerlegs/training.html`) or also under a prefix (`/tigerlegs/en/…`)?
2. Is a first visit redirected by browser language, or only offered a link?
3. Page titles and descriptions per language: from the same JSON files?
4. Which library: i18next, Paraglide JS or another? The owner sets the weights and the familiarity scores, then the spike decides.

## References

- ICT Research Methods. (n.d.). *Multi-criteria decision making*. Retrieved November 10, 2026, from https://ictresearchmethods.nl/workshop/multi-criteria-decision-making/
- Astro. (n.d.). *Internationalization (i18n) routing*. Retrieved November 11, 2026, from https://docs.astro.build/en/guides/internationalization/
