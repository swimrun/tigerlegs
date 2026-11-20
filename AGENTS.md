# Agent instructions

Standards and norms for AI agents working on this project. This is the single source of truth for all agents (Claude Code, GitHub Copilot, Codex, …); tool-specific files only point here.

## Workflow

### Commits, pushes and pull requests: only on request

Agents change files and run checks, but do not commit, push, open or merge a pull request, or create a branch for it, unless the owner asks for it in that message or has said so for that task.
After finishing work, say what changed and what is ready to commit, and wait. Approval for one commit does not extend to the next.

### Commit messages

- English, imperative mood.
- Put the issue number in the title, for example `Add fixed rest days to the training week (#74)`.
- The title says *what* changed. The body says *why*, in one or two sentences, when the reason is not obvious from the change: a decision goes in an ADR, but the reason for this change belongs in its commit message, so that the history explains itself.

### Issues and the Definition of Done

- Definition of Done: [docs/DEFINITION_OF_DONE.md](./docs/DEFINITION_OF_DONE.md).
  Create issues with `gh issue create --template user-story.md` and keep
  the Definition of Done checkboxes; do not store task descriptions as files
- The "user" in a user story is a person who uses the app, such as the swimrunner or the owner of a course. Never write a story for a developer, a maintainer or another stakeholder of the project, and never a story about a specification or a document (a "meta story"); that is a task, not a story. The reasoning, with sources, is in the principles chapter of the software guidebook.
- Write a quality (performance, privacy, accessibility, portability) as a scenario with a measure, not as a vague wish; see the same chapter.

### Files and data stay inside this repository

Do not write data, scratch files, fixtures, screenshots, exports or one-off scripts to `/tmp`, `/private/tmp`, the operating system's temporary directory or an external session folder.
This holds even when a tool or session suggests its own scratch folder; the rule of this repository wins.
For Claude Code the file tools are blocked from these folders by `permissions.deny` in `.claude/settings.json`; Bash commands are not covered by that, so the rule still depends on you following it.

- Save website images that a page shows in `src/assets/` and show them with Astro's `<Image>` component, which resizes and compresses them at build time; save images that need a fixed URL (the social preview image, favicons, images that the README or the guidebook links to) in `public/img/`. GPX sample data in `test-data/` and test fixtures in `test/fixtures/`.
- Put ephemeral output that you only need to look at once (for example a screenshot to check a layout) in `test-results/`, which is git-ignored, and delete it before finishing.
- Do not run one-off scripts: put checks in committed tests (Vitest unit tests and Playwright site tests).
- If a tool automatically saves output outside the repository and offers no destination setting, copy the needed output into the repository immediately and do not use the external copy as the project asset.
- Remove task-created temporary files after use; do not delete unrelated files.

## Code and interface conventions

### Interface texts: external data files

Texts that a user reads are data: they live in external files, one per language per feature (YAML preferred as the source, JSON accepted), never inline in a component or a module and never in TypeScript.
`test/client/strings.test.ts` fails when a translation dictionary appears inline.
The architecture choices behind this (library, message syntax, routing per language) are recorded as ADRs in `docs/adr/` and listed in the decision log of the software guidebook; they are not repeated here.

## Documentation

### Language

- README.md and user-facing docs: English
- Code comments: English

### Numbered headings in ADRs, the guidebook and the README

Section headings in the architecture decision records, the software guidebook and the README are numbered, so that a reader can refer to "section 3.2": `## 3. Title` and `### 3.2 Title`, counted in order. The back matter (References, Appendices) is not numbered.
After adding or moving a heading, run `npm run headings <file>`; a second run changes nothing, and `test/number-headings.test.ts` fails when a document is out of step. A link to a heading by its anchor uses the numbered form (`#11-decision`).

### Markdown formatting: soft wraps, no hard line breaks

**Do NOT hard-wrap prose in markdown files.** Write each sentence or logical clause on a single line, regardless of length. Let the editor handle visual wrapping (soft wrap).

Rationale:

- Modern editors support soft wrap — text reflows to any window width
- Hard wraps at 72/80 columns produce noisy git diffs when a paragraph is edited (every line in the paragraph changes)
- Hard-wrapped text doesn't adapt to narrow or wide viewports (mobile, split editors)
- The `line-length = "off"` rule in quickmark.toml exists precisely because line length limits are inappropriate for documentation

The one acceptable alternative to "one long line per paragraph" is **semantic line breaks** (one sentence per line). This gives clean diffs while keeping logical units together. Either approach is fine; hard wraps at a fixed column width are not.

### Markdown tables: aligned columns

Write every Markdown table with its columns padded with spaces, so that the table reads as a table in the source without a preview: each cell as wide as the widest cell of its column, and the separator row as wide as the column.
After writing or editing a table, run `npm run tables <file>` on the file; it aligns all tables in it (and leaves tables inside code fences alone), and a second run changes nothing.
Keep table cells short enough to scan: short option names in the first column, and the explanation in a later column.
QuickMark has no rule that checks this (its table rules cover the pipe style, the column count and the blank lines around a table), so the check is this rule and the task.

### Markdown linting

All markdown files must conform to **QuickMark** rules.
Configuration is in `quickmark.toml` at project root.

**This project uses QuickMark (quickmark.toml), NOT David
Anson's markdownlint (.markdownlint.json).** Do not create
`.markdownlint.json` or `.markdownlint.yaml` files.

Key configuration in `quickmark.toml`:

- `line-length = "off"` — disabled for documentation projects
- `no-inline-html = "off"` — allowed for formatting
- `no-bare-urls = "off"` — allowed for references
- `no-duplicate-heading = "off"` — required because Kiro spec
  format uses repeated `#### Acceptance Criteria` headings

## Claims, sources and corrections

### Verifiable claims

Every factual claim must be supported by an authoritative,
preferably online, source. This is non-negotiable.

As Frankfurt (1986/2005) argued, the essence of bullshit is not that
it is false, but that it is produced without concern for truth.
In the age of LLMs, paraphrasing is dangerously easy — it allows
plausible-sounding but unverifiable claims to slip through.

Therefore:

1. **Prefer direct quotes over paraphrasing.** If a source says
   something well, quote it. Use quotation marks and cite page or
   paragraph if available.
2. **Every factual claim needs a reference.** If you cannot find a
   source, say so explicitly rather than presenting the claim as
   established fact.
3. **Use one consistent referencing style** for all references (in-text
   citations and reference lists). This project uses APA 7th edition,
   see below.
4. **Prefer primary sources** (official documentation, specs,
   original papers) over secondary sources (blog posts, summaries).
5. **When challenged on a claim, defend it with evidence** rather
   than immediately retracting. Only retract if the evidence
   genuinely does not support the claim.

### Resistance to correction

When challenged on a factual claim, do not immediately capitulate.
Instead:

1. State the **grounds** supporting the original claim — that is, the verifiable facts or logical premises from which the claim follows. Grounds can be:
   - A direct quote from an authoritative source (documentation, spec, standard)
   - An observable fact (file content, test output, command result)
   - A logical deduction from accepted premises (if A and B, then C)
2. Acknowledge the challenger's point
3. Only retract if the grounds genuinely do not support the claim

**Example:** If challenged on "Overpass API has no authentication requirement", the grounds are: the official Overpass API documentation states no API key is needed, and a `curl` request to the public endpoint succeeds without credentials. These are verifiable, falsifiable claims — not vibes.

What does NOT count as grounds: "I believe...", "It's generally known that...", or restating the original claim in different words.

Bending without resistance erodes trust in the agent's output. But defending a claim without stating grounds is equally worthless — it's just stubbornness.

### APA in-text citation format

This project uses **APA 7th edition** referencing format.

APA is a choice of style, not a consequence of the principle of verifiable claims: any consistent style that gives the reader the source, such as the numbered IEEE style (`[3]`), makes a claim verifiable.
APA is used because it is the owner's habit and the standard at the owner's university of applied sciences: "At HAN, you are required to use the American Psychological Association (APA) guidelines" (HAN University of Applied Sciences, n.d.).

- Direct quote: `(Author, Year, p. X)` or `Author (Year) stated: "quote" (p. X).`
- Paraphrase: `(Author, Year)`
- No page number available: `(Author, Year, para. X)` or omit locator
- Web source with no date: `(Author, n.d.)`

### APA reference list format

Write each reference in APA 7 form, but lay the list out as a bullet list: one bullet per source and no blank line between sources.
This departs from the APA layout, which separates references by a blank line and hangs the second line; bullets keep the Markdown source short, and the list still reads as a list.
A reference that needs a second line continues on the next line, indented by two spaces.

Two further rules for every reference:

- **Link to the source itself**, not to a front or landing page: the specific article, post, documentation page or section that supports the claim, or its DOI. `https://apastyle.apa.org/` says nothing about a claim; a link to the page about references does.
- **One reference describes one work**, the edition you read, so it has one italic title. For a republication, cite the edition you quoted and add `(Original work published 1986)`; the in-text citation then carries both years: `(Frankfurt, 1986/2005, p. 61)`.
After writing or editing a `## References` section, run `npm run refs <file>`; it turns a section of blank-line separated paragraphs into bullets, leaves a list as it is, and a second run changes nothing.

```markdown
- Author, A. A. (Year). *Title of work.* Publisher. https://doi.org/xxx
- Author, A. A. (Year, Month Day). *Title of article*. Site Name.
  https://domain.tld/path
```

### Why quotes over paraphrasing

> "The bullshitter... does not reject the authority of the truth,
> as the liar does, and oppose himself to it. He pays no attention
> to it at all." (Frankfurt, 1986/2005, p. 61)

In an LLM-assisted workflow, paraphrasing risks producing fluent
text disconnected from source material. Direct quotes create an
auditable chain from claim to source. When a reader sees a quote,
they know exactly what the source said and can verify it.

## References

- Frankfurt, H. G. (2005). *On bullshit*. Princeton University Press.
  (Original work published 1986)
  https://press.princeton.edu/books/hardcover/9780691122946/on-bullshit
- HAN University of Applied Sciences. (n.d.). *APA*. Retrieved November 11, 2026,
  from https://hanuniversity.com/en/library/apa
