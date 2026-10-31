# Agent Instructions

Standards and norms for AI agents working on this project.

## Referencing standard: APA with direct quotes

This project uses **APA 7th edition** referencing format.

### Core principle: verifiable claims

Every factual claim must be supported by an authoritative,
preferably online, source. This is non-negotiable.

As Frankfurt (1986) argued, the essence of bullshit is not that
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
3. **Use APA 7th edition format** for all references (in-text
   citations and reference lists).
4. **Prefer primary sources** (official documentation, specs,
   original papers) over secondary sources (blog posts, summaries).
5. **When challenged on a claim, defend it with evidence** rather
   than immediately retracting. Only retract if the evidence
   genuinely does not support the claim.

### APA in-text citation format

- Direct quote: `(Author, Year, p. X)` or `Author (Year) stated: "quote" (p. X).`
- Paraphrase: `(Author, Year)`
- No page number available: `(Author, Year, para. X)` or omit locator
- Web source with no date: `(Author, n.d.)`

### APA reference list format

```markdown
Author, A. A. (Year). *Title of work.* Publisher. https://doi.org/xxx

Author, A. A. (Year, Month Day). *Title of article*. Site Name.
    https://domain.tld/path
```

### Why quotes over paraphrasing

> "The bullshitter... does not reject the authority of the truth,
> as the liar does, and oppose himself to it. He pays no attention
> to it at all." (Frankfurt, 1986, p. 61)

In an LLM-assisted workflow, paraphrasing risks producing fluent
text disconnected from source material. Direct quotes create an
auditable chain from claim to source. When a reader sees a quote,
they know exactly what the source said and can verify it.

## References

- Frankfurt, H. G. (1986). On bullshit. *Raritan, 6*(2), 81–100.
  Republished as: Frankfurt, H. G. (2005). *On Bullshit*.
  Princeton University Press. Also available online at for instance https://www.math.mcgill.ca/rags/JAC/124/bs.html
- American Psychological Association. (2020). *Publication manual
  of the American Psychological Association* (7th ed.).
  https://apastyle.apa.org/

## Other agent standards

### Files and data stay inside this repository

Do not write data, scratch files, fixtures or one-off scripts to
`/tmp` or any other folder outside this repository. Keep test data
under `test/fixtures/` and delete scratch files before finishing.
Do not run one-off scripts: put checks in committed tests (Deno
tests, and Playwright tests once added).

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

### Documentation language

- README.md and user-facing docs: English
- Code comments: English
- Commit messages: English, imperative mood

### Markdown formatting: soft wraps, no hard line breaks

**Do NOT hard-wrap prose in markdown files.** Write each sentence or logical clause on a single line, regardless of length. Let the editor handle visual wrapping (soft wrap).

Rationale:

- Modern editors support soft wrap — text reflows to any window width
- Hard wraps at 72/80 columns produce noisy git diffs when a paragraph is edited (every line in the paragraph changes)
- Hard-wrapped text doesn't adapt to narrow or wide viewports (mobile, split editors)
- The `line-length = "off"` rule in quickmark.toml exists precisely because line length limits are inappropriate for documentation

The one acceptable alternative to "one long line per paragraph" is **semantic line breaks** (one sentence per line). This gives clean diffs while keeping logical units together. Either approach is fine; hard wraps at a fixed column width are not.

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
