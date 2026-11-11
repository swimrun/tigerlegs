# 17. Localisation: JSON files, one URL per language and an i18n library

Date: 2026-11-11

## 1. Status

Accepted on 11 November 2026: the library is **i18next with react-i18next**, and the owner decided it without a spike. Translations are data in external files (YAML preferred as the source, JSON accepted), the ICU message syntax is preferred, and every language gets its own URL (decision 1 below). The migration is issue #84.
The comparison was close (i18next 415, Paraglide JS 410 on provisional scores); the owner judged that a spike would not be worth the time, after the length of the back-end spike of ADR-0014.

## 2. Context

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
| R8  | The visitor can switch language live, without a full page reload                                             |
| R9  | A first visit can start in the browser's language (the hosting is static: GitHub Pages)                      |

## 3. The three decisions

### 3.1 Routing: one URL per language (R3, R4)

Astro has built-in i18n routing: `locales` and `defaultLocale` in the configuration, translated pages in folders (`src/pages/fr/about.astro` gives `/fr/about/`, `src/pages/about.astro` the default language when `prefixDefaultLocale` is false), `Astro.currentLocale` in a page and `getRelativeLocaleUrl()` for links (Astro, n.d.).
Because the site is static, every page is built once per language, and `<html lang>` is written at build time.
The language switch becomes a list of links to the same page in the other languages, the `localStorage` choice and the script that rewrites `lang` disappear, and the layout adds `<link rel="alternate" hreflang="…">` for every language of the page.
**Live switching (R8).** With one URL per language, switching is a navigation to the other language's URL. The site already uses Astro view transitions, so the navigation swaps the page without a full reload, the URL changes, and a persistent island such as the chat can stay mounted and receive the new language. A library's `setLocale()` is not needed for that; note that Paraglide JS by default does "a full document navigation" when it switches (it navigates to the localized URL, or reloads), with `setLocale(locale, { reload: false })` as a narrow escape hatch (Paraglide JS, n.d.).
**Browser language (R9).** GitHub Pages is static and cannot choose a language by the `Accept-Language` header. A start in the browser's language is therefore a small client-side step on the first visit to the root: when no choice is saved and the browser language is offered, go to that language's URL; remember the choice afterwards. Whether this hurts search engines, which see the root without a saved choice, is to check; `hreflang` with an `x-default` link is the usual answer.
The pages should not be copied per language: one page file with a locale parameter generates all languages (to check against the Astro documentation of dynamic routes).

### 3.2 Loading: only the language of the page (R1, R2, R6)

Each page is rendered for its language at build time, and the React islands receive only the messages of that language, as props or through the library's provider.
Adding a language then means a new set of JSON files and one entry in `locales`; nobody downloads it unless they read that language.
The files are `<feature>/strings/<lang>.json` once the folders follow the feature structure of #83, for example `training/strings/nl.json`.

### 3.3 The library

The choice of library is made with the multi-criteria method of ADR-0014, below.

## 4. Method

The comparison follows the [ICT Research Methods multi-criteria decision making method](https://ictresearchmethods.nl/workshop/multi-criteria-decision-making/), as ADR-0009 and ADR-0014 did: alternatives, criteria and weights first, then each option judged per criterion, with time to iterate (ICT Research Methods, n.d.).
Scores run from 1 (poor) to 5 (excellent), weights add up to 100, and the total is the sum of weight times score.
The weights and the familiarity scores (C7) are the owner's to set; every other score is provisional and rests on search summaries and library documentation that have not been read in full ([Tolgee](https://tolgee.io/blog/react-i18n-libraries-comparison), [SimpleLocalize](https://simplelocalize.io/blog/posts/the-most-popular-react-localization-libraries/), [Locize](https://www.locize.com/blog/react-intl-vs-react-i18next), [Paraglide JS](https://github.com/opral/paraglide-js), [i18next-icu](https://github.com/i18next/i18next-icu)), so they must be checked, and the spike below is meant to do that.

## 5. Alternatives

| Option                         | What it is                                                                                                                                                        |
| ------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **i18next + react-i18next**    | The core library with plugins and hooks for React; own message format, ICU through a plugin                                                                       |
| **react-intl (FormatJS)**      | ICU MessageFormat in JSON, messages passed to a provider; `intl-messageformat` works outside React                                                                |
| **Lingui**                     | The texts are written in the code and a tool extracts them into one catalog (a translation file) per language; ICU                                                |
| **Paraglide JS**               | JSON messages (`messages/en.json`, `"greeting": "Hello {name}!"`) compiled to type-safe, tree-shakable functions; MIT; supports Astro, React and plain TypeScript |
| **Hand-made TypeScript files** | Dictionaries in code: today's stopgap                                                                                                                             |

Others exist (Tolgee, Intlayer, next-intl, which is for Next.js); they are left out because they are tied to a platform or a framework we do not use.

## 6. Criteria and weights (draft)

| #   | Criterion                                 | Weight | What it asks                                                                                                                |
| --- | ----------------------------------------- | ------ | --------------------------------------------------------------------------------------------------------------------------- |
| C1  | Translations are data (YAML or JSON)      | 15     | External files, separate from code; YAML preferred as the source (comments, no quoting noise), converted at build time (R1) |
| C2  | Only the active language is loaded        | 10     | Messages of one language per page, so more languages do not grow the download (R2)                                          |
| C3  | Plain TypeScript and React islands        | 15     | The same library in the React islands and in the chat agents (R5)                                                           |
| C4  | ICU MessageFormat                         | 15     | Variables, plurals and select in the standard ICU syntax, which the owner prefers (R6)                                      |
| C5  | Type safety and completeness checks       | 10     | A missing key or a wrong variable fails a check (R7)                                                                        |
| C6  | Fit with Astro routing and a static build | 10     | Works at build time and with one URL per language (R3, R4)                                                                  |
| C7  | Familiarity                               | 10     | How well the owner knows it or wants to learn it (the owner's to score)                                                     |
| C8  | Ecosystem and long-term health            | 5      | Maintenance, community, documentation                                                                                       |
| C9  | Autonomy                                  | 5      | Who owns it, and the licence (criterion C8 of ADR-0014); not yet looked up for these                                        |
| C10 | Size on the page                          | 5      | What it adds to the JavaScript of a small site                                                                              |

## 7. Evaluation (provisional)

| Option                     | C1 (15) | C2 (10) | C3 (15) | C4 (15) | C5 (10) | C6 (10) | C7 (10) | C8 (5) | C9 (5) | C10 (5) | Total   |
| -------------------------- | ------- | ------- | ------- | ------- | ------- | ------- | ------- | ------ | ------ | ------- | ------- |
| i18next + react-i18next    | 5       | 4       | 5       | 4       | 4       | 4       | 3       | 5      | 3      | 3       | **415** |
| Paraglide JS               | 5       | 4       | 5       | 3       | 5       | 4       | 3       | 3      | 3      | 5       | **410** |
| react-intl (FormatJS)      | 5       | 4       | 3       | 5       | 3       | 3       | 3       | 4      | 3      | 2       | **370** |
| Lingui                     | 4       | 4       | 3       | 5       | 5       | 2       | 3       | 3      | 3      | 5       | **375** |
| Hand-made TypeScript files | 1       | 2       | 5       | 1       | 4       | 3       | 5       | 2      | 5      | 5       | **305** |

How the scores were obtained: i18next works in plain JavaScript as well as React and keeps resources in JSON (C1, C3), has the largest community (about 3.5 million downloads a week, C8), needs a plugin for ICU (C4) and is about 6 KB with react-i18next (C10); react-intl is ICU native (C4) but about 20 KB (C10) and React first (C3); Lingui is about 2 KB with strong typing (C5, C10) but works through build-time macros whose fit with Astro is to check (C6); Paraglide compiles to typed functions that work anywhere (C3, C5) and is small (C10), but is newer (C8) and how it ships only one language per page is to check (C2); the hand-made files fail C1 and C4 by construction.
All C7 scores are my placeholder, 3 for every library and 5 for the files the project already uses; the owner sets them. The owner leans towards Paraglide JS: with 5 for Paraglide and 3 for i18next, Paraglide leads with 430 against 415.

ICU (C4): react-intl is ICU native; i18next needs the official `i18next-icu` plugin, after which only ICU syntax is read; Lingui uses ICU; Paraglide's own message format is not ICU, but an inlang plugin stores ICU messages in JSON files per locale (select, plural, selectordinal, exact matches and offset) (Paraglide JS, n.d.; inlang, n.d.). So react-intl is not the only library with ICU.

### 7.1 Dependence on Astro

The library does not decide how dependent we are on Astro; the routing does. One URL per language through Astro's i18n routing ties the page structure to Astro, which Cloudflare now owns (ADR-0014). All of the libraries above are framework independent: i18next and Paraglide JS also run in a plain TypeScript module, in React without Astro, in SvelteKit or in a bare Vite app, and Paraglide JS can even do the URL mapping itself (`localizeUrl` and `deLocalizeUrl`, for example `/de/ueber` for `/about`), which would keep the language routes out of Astro (Paraglide JS, n.d.; whether that works with Astro's static build is to check).
Who maintains Paraglide JS is not clear from the sources read: its README names the organisation opral, a summary of its GitHub page named another; the owner of each library is still to look up for criterion C9.

### 7.2 Reading the result

i18next and Paraglide JS are close, 415 against 410; the owner decided for i18next without a spike (see the decision below). The tie comes from facts in Paraglide's own documentation, which raised two of its scores: it offers per-locale builds that "remove other languages from each locale's client graph" (C2, an option and not the default), and its messages support `plural`, `number`, `datetime` and `relativetime` through formatters (C4) (Paraglide JS, n.d.).
The loading requirement (C2) does not decide between the libraries: every one of them can receive the messages of a single language, and decision 2 above does that work through routing. "The same library in the islands and the agents" (C3) means that the library offers a plain function that a React component and a plain TypeScript module can both call (`t("key", { day })` or `m.key({ day })`); a library that only offers React hooks cannot be called from the agents, which are not components.

## 8. Sensitivity

- If the owner knows i18next well (C7 = 5 against 3 for the others) its total is 440 against 420 for Paraglide JS.
- If size and type safety weigh more (C5 and C10 at 15 each, C8 and C1 lowered), Paraglide JS and Lingui gain and Paraglide leads. If the owner knows i18next well (C7), i18next leads; if the owner prefers Paraglide's functions, Paraglide leads.
- If ICU everywhere is the first requirement (C4 at 20), react-intl and Lingui gain.
- If autonomy (C9) turns out to differ between the projects, the owners of each need to be looked up first: not done.

## 9. Decision

The owner chose **i18next with react-i18next** (issue #84).
Decided without a spike. What this gives up: Paraglide JS's compile-time type safety and smaller bundles. What makes up for it: i18next types its keys by declaration merging, and `test/client/strings.test.ts` becomes a test that every language file has the same keys (R7).
To settle during the migration, not before: whether the official `i18next-icu` plugin is used (the owner prefers ICU; with the plugin only ICU syntax is read), and whether the YAML source is converted by `vite-plugin-i18next-loader` or by our own build step with JSON as the fallback.
Reconsider the library if the page bundles grow noticeably because of it, or if missing keys keep reaching production in spite of the key-parity test.

## 10. Two kinds of localisation

The library here is for the **texts of the interface**: static files that ship with the code and change when the code changes.
The events and profiles that the owner wants to edit later (create, read, update, delete) are **content**: stored in the database and written by users. An i18n library does not do that, and no library in the table is chosen or excluded by it; the data model does it, for example a `LocalizedText` value object (a text per language with a fallback language) on the aggregates that hold names and descriptions, such as the course variant descriptions of the guidebook (section 6.6), which are English only today.
What the libraries still give that content is the formatting around it: plurals, numbers and dates in the visitor's language, and messages that take a user's text as a variable.

## 11. YAML as the source format

YAML is easier to maintain by hand: it allows comments for translators and multi-line texts without quote noise, which JSON does not. None of the libraries reads YAML directly, so the source is converted at build time: for i18next there is a Vite plugin that bundles locales from JSON or YAML files (`vite-plugin-i18next-loader`, which uses js-yaml); Paraglide JS reads any file format through inlang plugins, and whether a YAML plugin exists is to check, the fallback being a build step that writes the JSON.
One catch: in YAML a plain value cannot start with `{`, so an ICU message that starts with a variable or a plural must be quoted (`"{count, plural, one {# session} other {# sessions}} did not fit"`), which takes away some of YAML's advantage for ICU texts.

## 12. Translation workflow

Translating apart from the code is what a translation management system does. Weblate is open source (GPL v3), Czech, can be self-hosted, syncs with Git and supports JSON and YAML files and checks ICU strings (Weblate, n.d.; from search summaries, to check). It is not needed yet: with four languages the files can be edited by hand.

## 13. Consequences and migration

1. Add the `i18n` configuration, move the pages to locale routes, set `<html lang>` and the `hreflang` links in the layout, and turn the language select into links. Playwright checks that every language URL has the right `lang` and alternates.
2. Add the library, move the training and chat texts from the stopgap TypeScript files into JSON, and replace the functions (`movedFromTo`, `notPlaced`) by messages with variables and plurals.
3. Give the About page its content per language (now both languages are in one file), and the extractor page its first translation (it is English only).
4. Remove `language-switch.ts` and the `MutationObserver` on `lang`; keep the FAQ JSON, which already is per language.
5. Replace the guard test on `*.strings.<lang>.ts` by a test that every language file has the same keys (R7).

## 14. Open questions

1. Is the default language at the root (`/tigerlegs/training.html`) or also under a prefix (`/tigerlegs/en/…`)?
2. Is a first visit redirected by browser language, or only offered a link?
3. Page titles and descriptions per language: from the same JSON files?
4. Whether `i18next-icu` is used, and whether YAML is converted by the Vite plugin or by our own build step.

## References

- inlang. (n.d.). *ICU MessageFormat 1 plugin* [Plugin documentation]. Retrieved November 11, 2026, from https://inlang.com/m/reootnfj/plugin-inlang-messageFormat
- Weblate. (n.d.). *Supported file formats*. Retrieved November 11, 2026, from https://weblate.readthedocs.io/en/latest/formats.html
- Paraglide JS. (n.d.). *Paraglide JS* [README and documentation]. GitHub. Retrieved November 11, 2026, from https://github.com/opral/paraglide-js
- ICT Research Methods. (n.d.). *Multi-criteria decision making*. Retrieved November 10, 2026, from https://ictresearchmethods.nl/workshop/multi-criteria-decision-making/
- Astro. (n.d.). *Internationalization (i18n) routing*. Retrieved November 11, 2026, from https://docs.astro.build/en/guides/internationalization/
