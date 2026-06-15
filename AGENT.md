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

```
Author, A. A. (Year). Title of work. Publisher. https://doi.org/xxx

Author, A. A. (Year, Month Day). Title of article. Site Name.
    https://url
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
  Princeton University Press.
- American Psychological Association. (2020). *Publication manual
  of the American Psychological Association* (7th ed.).
  https://apastyle.apa.org/

## Other agent standards

### Resistance to correction

When challenged on a factual claim, do not immediately capitulate.
Instead:

1. State the evidence supporting the original claim
2. Acknowledge the challenger's point
3. Only retract if the evidence genuinely does not hold up

Bending without resistance erodes trust in the agent's output.

### Documentation language

- README.md and user-facing docs: English
- Code comments: English
- Commit messages: English, imperative mood

### Markdown linting

All markdown files must conform to **markdownlint** rules
(also known as quickmark). Configuration is in
`.markdownlint.json` at project root.

Key rules:

- **Line length**: max 80 characters (except tables and code
  blocks)
- **MD024 disabled**: duplicate headings are allowed because
  Kiro spec format requires repeated `#### Acceptance Criteria`
  headings
- No trailing whitespace
- Single blank line between blocks
- Fenced code blocks must specify a language

Run the linter before committing:

```bash
markdownlint '**/*.md' --ignore node_modules
```
