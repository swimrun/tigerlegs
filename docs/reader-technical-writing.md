---
title: Technical writing for developers
author: HAN lecturers
subtitle: v0.3
date: '2026-05-21'
updated: '2026-10-14'
coverImage: img/software-guidebook-boek-werkplek.png
coverAlt: Decorative illustration of a Software Guidebook on a workstation
---

## Version history

| Version | Date | Changes |
|---------|------|---------|
| v0.1 | 2026-05-21 | First version: technical writing, SGB, ADR, APA |
| v0.2 | 2026-08-18 | Ch. 6 APA as a separate chapter; Jevons' paradox; footnote example; quiz added |
| v0.2.2 | 2026-09-11 | OpenCSV/JaCoCo example added: splitting review feedback into MR scope, maintainability, naming and optional modern syntax |
| v0.2.3 | 2026-10-01 | Decorative image on the cover page only; references to lessons and weeks removed |
| v0.3 | 2026-10-02 | §3.2 Active writing: avoid the passive voice; reading guides following the Pyramid Principle (§3.3), also applied in this reader; tables and figures numbered, with a C4 diagram as a figure example; SGB chapters Principles, Code and Data clarified |
| v0.4 | 2026-10-14 | All headings have a continuous section number, so the double number in the PDF (such as `0.2 1. Introduction`) disappears; the content is otherwise unchanged |
| v0.5 | 2026-10-22 | §3.3.2: chapters with numbers and appendices with letters according to APA (Merkus, 2022); appendices after the reference list under an unnumbered heading *Appendices* |
| v0.6 | 2026-10-22 | §3.6: explain acronyms and technical terms at first use (full term in italics, acronym in parentheses), use English technical terms and add a table of terms as an appendix at the end |

## 1. Introduction

As a software engineer you create two things: software and the documentation that goes with it. That sounds obvious, but in practice documentation is often the neglected stepchild. Writing code feels productive; writing documentation feels like administration. Yet good technical documentation is essential — especially now that AI generates more and more code.

Chapter 2 explains why documentation matters, precisely now that AI writes more and more code; read it if you doubt whether documenting is worth the effort. Chapter 3 is the core: guidelines for clear, reader-focused writing, from active voice to figures and tables. Use it as a reference for every text you write. Chapter 4 describes the Software Guidebook (SGB) and which of its chapters you fill in during this course. Chapter 5 shows how to keep documentation up to date while you write code, and chapter 6 gives short practical tips. Chapter 7 covers referencing with APA; read it before you include sources in your SGB or ADRs.

## 2. Why technical documentation matters

This chapter first describes the role documentation plays in industry (2.1). It then shows why that role grows now that AI generates code (2.2), and why AI as a writing aid does not automatically make the work less (2.3).

### 2.1 Documentation in industry

In many companies documentation is outdated, incomplete or absent. Developers rely on verbal handover, Slack messages or "the code speaks for itself". That works as long as the team is small and nobody leaves. As soon as a new team member joins or a system needs maintenance after two years, the problem appears: nobody knows anymore *why* certain choices were made.

Lecturer Theo Theunissen of HAN University did years of research into modern software documentation methods (and the lack thereof) and has a much broader view of what software documentation is than many others, who still mostly think of Word documents with a 'Functional Design' and a 'Technical Design'.

For example, the commit messages in the version control system (typically Git) are also a form of documentation. Theunissen argues that commit messages often do record *what* has changed, but not *why* the source code was changed. But WHAT changed can in principle also be derived from the code changes themselves, increasingly with the help of AI. So be sure to add the why — the rationale — as well, and record it as close to the source code itself as possible. For example in pull requests or commits (Theunissen, 2023).

### 2.2 Documentation in the AI era

Robert C. Martin already wrote in 2008 in *Clean Code* (so long before the rise of LLMs):

> "One might argue that a book about code is somehow behind the times—that code is no longer the issue. That soon all code will be generated instead of written. That programmers simply won't be needed because business people will generate programs from specifications. [...] Nonsense! We will never be rid of code, because code represents the details of the requirements." (Martin, 2008, p. 2)

Martin meant: however high the level of abstraction becomes, in the end someone (or something) has to specify precisely what the system must do. That specification *is* the code; even if it may become something other than a programming language like Java (and sometimes already is; such as Gherkin scenarios, which you will learn in a later course).

Now that in 202x AI tools such as GitHub Copilot and ChatGPT generate more and more code, the role of the developer shifts. You write fewer lines of code yourself, but you do have to be able to specify precisely *what* the system must do and *why*. That specification — in the form of requirements, architecture decisions and design choices — becomes more important as AI takes over more implementation details.

Concretely, this means:

- A well-written analysis document yields better AI-generated code than a vague request.
- A clear design document prevents AI tools from making choices that do not fit your architecture.
- Documentation that explains *why* a choice was made helps future developers (and AI tools) to respect that choice or to reconsider it deliberately.

### 2.3 AI as a writing aid and Jevons' paradox

You are allowed to use AI to write documentation — just as for code. We cannot forbid it or detect whether you do. But using AI as a writing aid shifts the responsibility; it does not eliminate it: the new AI era mainly raises the quality requirements for documentation.

This phenomenon is known as *Jevons' paradox*: an efficiency improvement does not lead to less effort, but to higher expectations. The classic example is the vacuum cleaner: when it was introduced, the idea was that it would reduce housework. In practice, hygiene standards went up — a dust-free home was suddenly an achievable expectation, so the work did not decrease, but sometimes even increased.

The same holds for AI and documentation:

- Spelling mistakes are no longer acceptable — AI can remove them effortlessly.
- A poorly structured document can no longer be defended with "no time" — AI can generate an initial structure. If you extend the text, AI can adjust the structure to fit again.
- Missing references are no longer excusable — AI can look up and format sources.[^1]

[^1]: Although LLMs are currently not very good at referencing. Presumably because they were trained on a *body of work* in which the writers were not very good at proper referencing either. An LLM returns what it was trained on, not what is truly good. Until you explicitly instruct the LLM to do so, and also give it the quality criteria and examples of good source use and references. You also have to give concrete examples, in generated material, of where it goes wrong, with improvements that the LLM can then apply more generally. You cannot leave it at one prompt. In other words: "One prompt is no prompt."

The norm shifts: what used to be "good enough" is now sloppy. The expectation is that your documentation is of higher quality *because* you have better tooling. You are still ultimately responsible for the content, correctness and completeness — AI does not relieve you of that.

## 3. Writing technical text well

The guidelines in this section are based on the online Google Technical Writing course (https://developers.google.com/tech-writing) and supplemented with specific points of attention for software developers. Sections 3.1 and 3.2 cover the reader and active writing. Sections 3.3 through 3.6 cover structure, lists, substantiation and terminology. Section 3.7 covers figures and tables, and section 3.8 covers code that documents itself.

### 3.1 Reader-focused writing

Make clear for every section *why* the reader needs to read it. Give context: what is the question, what is the evidence, what follows from it?

Not good:

> "Scalability is important."

Better:

> "This architecture supports 10x growth without redesign, which is relevant when the number of users grows faster than the infrastructure can keep up with."

#### 3.1.1 Example: reader-focused writing in merge request feedback

This also applies to review feedback in a merge request (see also the reader *Collaborating and integrating in brownfield projects*, section 3.2). If you address several different points, split them into separate paragraphs or bullets instead of cramming everything into one running sentence — that makes it clear to the reader which point belongs to which observation.

Suppose you are reviewing the CSV export feature from TicketFaster.

Not good (two topics in one sentence, no separation):

> "This doesn't look tidy and that dependency could have been separate too."

Better (separated per topic, with reasons):

> - **Scope of the MR**: the dependency and the code that uses it belong in the same merge request, because the code does not compile without the dependency.
> - **Maintainability**: if you see separate `.toString()` calls on similar fields in several places in the mapping to `TicketExportRow`, a small helper method is a suggestion — that way a future field change only needs to be made in one place.
> - **Naming**: a variable such as `list1` does not tell the reader what is in it; a name such as `exportRows` makes it clear at a glance what the collection contains.
> - **Modern syntax (optional)**: for a local variable whose type is already clear from the assignment you can consider `var`. This is a style choice, not a requirement — present it as a suggestion ("this could also work"), not as a demand.

The second version makes it immediately clear that the first point is about MR scope and the others about code quality — different kinds of feedback that should not be mixed together.

### 3.2 Active writing: avoid the passive voice

Write in the active voice: the subject of the sentence performs the action. In the passive voice the action comes first and the performer often disappears from the sentence. The reader then has to guess who does something. The Google Technical Writing course puts it like this:

> "Passive voice obfuscates your ideas, turning sentences on their head. Passive voice reports action indirectly. Some passive voice sentences omit an actor altogether, which forces the reader to guess the actor's identity." (Google, 2025)

Moreover, the active voice is usually shorter. Also watch the short video *Active Voice vs. Passive Voice* from this course: https://www.youtube.com/watch?v=nG6DhoFt938.

For requirements this is extra important. A requirement in the passive voice can be grammatically correct and still be unclear, because nobody knows who has to deliver the behavior. IBM states the rule for requirements like this: "Effective requirements clearly state who or what performs an action. Rewrite the requirement to clearly identify and focus on the actor." (IBM, n.d.). For developers this feels familiar: in your design too, you assign every responsibility to a class or component.

Table 1 gives examples from different kinds of texts you write in this course.

*Table 1*: Passive and active voice in FUSTEN texts.

| Type of text | Passive voice | Active voice |
|--------------|---------------|--------------|
| Requirement | An error message is displayed if the amount is negative. | The frontend displays an error message if the amount is negative. |
| Design | The expense is validated and stored. | `ExpenseService` validates the expense and `ExpenseRepository` stores it. |
| ADR | Spring JDBC was chosen. | The team chooses Spring JDBC, because that way you see the SQL yourself. |
| Introduction | In chapter 4 the architecture is described. | Chapter 4 describes the architecture. |

The last example uses the IS-AV construction (*inanimate subject, active verb*): an inanimate subject, such as a chapter or section, with an active verb. This construction is handy in structuring sentences, such as in an introduction or reading guide, where you do not want to use the first person (I or we) (Vleeshouwers, 2024). Scribbr gives as an example: "This section shows the main points of attention." (Vleeshouwers, 2024).

The passive voice is not forbidden. Use it deliberately when the performer is unknown or less important than the action; IBM (n.d.) also mentions that exception. "The database is backed up every night" is fine if it does not matter which process does that.

**Tip:** search your text for *is*, *are*, *was*, *were*, *been* and *be*. If you find them often (for example more than ten times), rewrite those sentences in the active voice. ~~Usually your text gets shorter that way too~~. That also usually makes your text shorter.

### 3.3 Structure and headings

Use informative headings that summarize the content. Avoid questions in headings — ask those in the running text. Number sections so you can easily refer to them.

Use section numbering at most down to level H4, so `x.y.z`. Numbering deeper points to an overly complex structure. Linus Torvalds formulates this principle for code, but it applies equally to writing: "if you need more than 3 levels of indentation, you're screwed anyway, and should fix your program" (Torvalds, n.d.). A document with more than three levels is better written flatter or split up.

#### 3.3.1 Reading guides: let the reader choose

Start a document with a reading guide in the introduction. For each chapter, state in one or two sentences what the reader will find and when it is relevant to them. A table of contents only lists titles; a reading guide helps the reader choose. Also start each chapter with a short introduction announcing the sections that follow. That way the reader can read the sections that are relevant to them and skip the rest. That costs the writer more work and the reader less.

This is an application of the *Pyramid Principle* by Minto (2009): put the core at the top and let the parts that elaborate on that core follow below it, with each level summarizing what is beneath it. The reading guide in the introduction is the top of the pyramid for the whole document; the introduction of a chapter is the top for that chapter.

Not good (merely repeating the table of contents, but now in sentences):

> "Chapter 2 is about the architecture. Chapter 3 is about the data."

Better (what the reader finds, and when they need it):

> "Chapter 2 shows why the frontend only talks to the database via the backend API; read it before you add a new feature. Chapter 3 describes which data the application stores and how you extend the data model."

In a Software Guidebook it works the same way: the introduction says which chapter answers which question, and each chapter starts with the most important choice or conclusion. This reader applies it itself as well.

#### 3.3.2 Chapters with numbers, appendices with letters

Number chapters and sections with numbers (1, 1.1, 1.1.1) and appendices with letters. That is the convention in APA. Merkus (2022) writes: "If you add more than one appendix, you call the appendices "Appendix A", "Appendix B", and so on." So it is called *Appendix A* and not *Appendix 1*. With a single appendix you simply call it "Appendix" (Merkus, 2022).

Place the appendices after the reference list (Merkus, 2022: "You place the appendices after your reference list."), under a heading of their own, *Appendices*, without a chapter number. Below it, each appendix gets a heading with a letter and title, such as *Appendix A: Title*. That way the numbers for the chapters stay continuous, and a reference such as "see Appendix A" cannot be confused with "see chapter 1". The reference list and the version history also get no number.

Merkus (2022) notes: "Most universities of applied sciences and universities use the APA guidelines only for referencing and not for formatting." So check which formatting your program or client requires. In technical documentation you follow the APA convention for appendices, unless an assignment or house style prescribes otherwise.

### 3.4 Introducing lists

Every list first gets a short introductory sentence that explains why the list is relevant. Avoid bare lists without context.

### 3.5 Substantiation and use of sources

The most important rule for technical writing: substantiate your claims. Every claim that is not self-evident, you link to a source or explicitly mark as an assumption.

Guidelines for using sources:

- **Quote rather than paraphrase.** A literal quote is verifiable; a paraphrase can unintentionally shift the meaning. This is extra relevant now that LLMs paraphrase easily — a direct quote proves that you have actually read the source (van der Wal, 2025).
- **Choose reliable sources.** Prefer recognized experts, official documentation and sources with a clear author and date.
- **Separate fact, interpretation and decision.** A fact is verifiable. An interpretation is your explanation of it. A decision is your choice based on both.
- **Follow APA 7 for referencing.** Use (Author, Year) in the text and an alphabetically sorted reference list at the end.

### 3.6 Terminology

Use consistent terms throughout the document. Choose one term and stick to it. Define jargon at first use.

Explain acronyms and technical terms at the place where they first appear. Write out the full term, set it in italics and put the acronym in parentheses after it, for example: *Data Access Object* (DAO). Repeat that explanation the first few times the term returns, especially if one or more chapters lie in between. Readers often jump to a chapter and do not read it from the beginning. For technical terms use the common English name, such as *large language model*, and not a forced translation into another language.

Put a table of terms and abbreviations as an appendix at the end of the document, and not as the first chapter, as often happens in SRS and SDD documents. The table is meant for quick lookup; the explanation at first use remains necessary.

### 3.7 Images and diagrams

Use images and diagrams to make your document more accessible. Google Technical Writing describes the effect:

> "when it comes to reading technical material, the vast majority of adults are still little kids—still yearning for pictures rather than text." (Google, n.d.-b)

Research confirms that images increase reading enjoyment, but that only *instructive* images (which clarify something) also improve understanding. Decorative images make a document more attractive but do not help with learning and understanding (Sung & Mayer, 2012). The underlying principle is known in educational psychology as the "multimedia effect": "a large number of studies have obtained desirable effects on learning outcomes from presenting both text and pictures (i.e., multimedia) compared with presenting text only" (Schweppe et al., 2015, p. 24).

Guidelines for using images in technical documents:

- **Number every instructive image** with a figure number: *Figure 1*, *Figure 2*, etc. Numbering makes it possible to refer to the image from the text. Purely decorative images (e.g., an atmosphere photo) do not need to be numbered.
- **Give every instructive image a caption** that briefly describes what the reader sees. Keep it to one line. If you want to say more, make the caption a short summary and put the longer explanation in the running text, with the figure number ("Figure 2 shows that …"). A caption also helps with accessibility: screen readers use the caption and the alt text to describe the image to users who cannot see. For decorative images the opposite applies: "for images that are purely decorative it is recommended to leave the alternative descriptions empty (`alt=""`)" (Brakel, 2021). An empty alt text tells the screen reader that the image carries no substantive information and that it can skip it.
- **Refer to the figure number from the text** ("see Figure 3") so the reader knows what the image belongs to and when it is relevant. Without a reference, the reader has to guess whether the image belongs to the previous or the next paragraph. By referring explicitly you involve the image in your argument. Steps 3 and 4 can often be combined in one sentence, for example: "As Figure 2 shows, it is important to..." or "The C4 Container diagram shown in Figure 3 contains no method call details, but the `ThrowDiceService` contains four methods as discussed in section 7.3 on Code."
- **Explain the image in the running text.** A diagram without explanation is like a table without an introductory sentence: the reader has to guess what is relevant. The explanation describes what you want to emphasize in the image and what the image alone does not communicate.

![Infographic with the four guidelines for images in technical documentation](img/richtlijnen-afbeeldingen-in-technische-documentatie.png)

#### 3.7.1 ANNOTATing = SPOTLIGHTing + ADDing

This principle applies not only to images, but to all elements you include in your text: tables, lists, code blocks, diagrams. A good annotation does two things:

1. **SPOTLIGHT** — select which part of the element deserves attention. Not everything is equally important; point the reader to the relevant part, and do NOT walk through everything (but... put a SPOTLIGHT on something)
2. **ADD** — add information that the element/diagram does not communicate on its own. Why is this relevant? What is the implication?

For tables the following also applies: if a table cell contains more than two sentences, consider whether that information would be better as a regular paragraph (Google, n.d.-a). Introduce every table and every list with a sentence that indicates what the reader can expect (Google, n.d.-a).

#### 3.7.2 Example

A diagram with only "Architecture diagram" as its caption, without a reference or explanation in the text, leaves the reader guessing what it shows and why it is there. Figure 2 shows how it can be done better.

![C4 container diagram of the film festival application](img/c4-container-filmfestival.png)

Figure 2 shows that the frontend has no direct access to the database. All data requests go through the backend API. The backend accesses the database and an external poster API. This separation is a deliberate choice to shield the database from the outside world.

This example is better in four respects:

1. **Informative caption**: "Architecture diagram" does not say what kind of diagram it is or which system it concerns. "C4 container diagram of the film festival application" does.
2. **Short caption**: the caption fits on one line. The explanation is in the running text.
3. **Figure number**: the text refers to "Figure 2", even if the layout places the image elsewhere or on another page.
4. **Annotation**: the paragraph spotlights one thing (the frontend does not talk directly to the database) and adds what the diagram itself does not tell (that this is a deliberate choice, and why). That is ANNOTATing.

### 3.8 Self-documenting code as documentation

Code is itself documentation too. At least, good code is. Good naming often makes comments superfluous:

```java
// Not good
int x = getP(); // get price

// Better
int productPrice = getProductPrice();
```

Comments in code explain *why* something is the way it is, not *what* it says — you can already see that in the code itself.

## 4. The Software Guidebook

<img src="img/simon-brown-software-guidebook.png" alt="Simon Brown presenting on software architecture documentation" align="right" width="300" style="margin-left: 1em; margin-bottom: 0.5em;" />

Simon Brown introduced the **Software Guidebook** (SGB) as an alternative to traditional — often outdated — software documentation. The idea: bundle all relevant information about a system in one living document that grows along with the code (Brown, 2022).

Section 4.1 describes which chapters an SGB can contain, and section 4.2 where architecture, design and code conventions end up in it. Section 4.3 links the SGB to the documents from year 1. Sections 4.4 and 4.5 show what you fill in during this course and what comes later.

### 4.1 What is in a Software Guidebook?

A Software Guidebook (SGB) can contain the chapters from Table 2. Brown describes this as a template: not every project has to fill in every chapter. Sections such as Context, Functional Overview and Software Architecture are relevant for virtually every system; sections such as Operation & Support or Infrastructure Architecture you only fill in if the system runs in production on its own infrastructure. The SGB of the film festival case, for example, contains no chapter on Operation & Support, because the application does not (yet) run in production for real users.

*Table 2*: Chapters of a Software Guidebook.

| #  | Chapter                  | Description                                                                       |
| -- | ------------------------ | --------------------------------------------------------------------------------- |
| 1  | Context                  | What does the system do and for whom? What are the external dependencies?          |
| 2  | Functional Overview      | What functionality does the system offer?                                          |
| 3  | Quality Attributes       | Which quality requirements apply (performance, availability, security)?            |
| 4  | Constraints              | Which technical and organizational constraints are there?                          |
| 5  | Principles               | Which design principles do we follow?                                              |
| 6  | Software Architecture    | What does the structure look like at a high level (C4 diagrams)?                   |
| 7  | Code                     | How have you organized the code? Which patterns and conventions do you use?        |
| 8  | Data                     | How and where does your application store data, and how does that data get exchanged with other systems?                               |
| 9  | Infrastructure Architecture | Which servers, networks and cloud services do you use?                     |
| 10 | Deployment               | How do you roll out the system and how do you manage it? The `README.md` in the root of your repo should always contain a "how to run" section that enables a new developer to start the application (Microsoft, n.d.). The SGB can better refer to it than duplicate it. |
| 11 | Operation & Support      | How do you monitor and maintain the system?                                  |
| 12 | Development Environment  | Which tools, IDEs and local setup are needed to develop?                  |
| 13 | Decision Log             | Overview of architecture decisions taken. Refers to the individual ADRs (e.g. `docs/adr/001-*.md`) for the details. |

### 4.2 Architecture, design and code conventions

Fowler quotes Ralph Johnson with a short definition: "Architecture is about the important stuff. Whatever that is" (Fowler, 2019). That sounds vague, but it is precisely useful: a team has to decide for itself which design choices are important enough to steer, document and guard explicitly.

In this course we use the following rule of thumb: architecture is about important design decisions that are hard or expensive to change later. A programming language, database platform, communication style between frontend and backend, authentication approach or package structure can therefore be architecture. Such choices affect many files, team habits, deployment, tests and sometimes even data that is already in production.

Not every agreement that is visible everywhere is automatically architecture. Naming, formatting and mappings between layers are often code or data conventions. You record the choice of technology or global structure in Ch. 6 (Software Architecture) or in an ADR in the Decision Log. You describe the concrete elaboration in packages, classes, naming conventions and mappings in Ch. 7 (Code).

An example: if you use Java and PostgreSQL, `customer_id` in the database can correspond to `customerId` in Java. The choice for Java and PostgreSQL can be architectural. The concrete casing mapping usually belongs in Ch. 7 (Code), because it explains how developers consistently apply the chosen technologies.

AI tools can make some technical migrations cheaper: rewriting an application to another language or framework is less unthinkable than it used to be. That does not mean architecture disappears; it shifts where the difficulty lies. Domain rules, data meaning, integration agreements, team knowledge and dependencies on other applications often remain hard to change. That is why in larger projects we steer toward package-by-feature: the code should make the domain and the use cases visible, not just the framework used.

This ties in with Martin's idea of "screaming architecture": "so should the architecture of a software application scream about the use cases of the application" (Martin, 2011). In other words: the structure of your application should show which domain and which use cases are central. In a film festival application you therefore want to see words such as `screening`, `ticket`, `edition` or `venue`, not just technical folders such as `controllers`, `services` and `repositories`.

### 4.3 Mapping to year 1 documents and common terminology

In year 1 you wrote separate documents: an assignment description, an analysis document and a design document. The Software Guidebook bundles these in a coherent structure. In industry and in later years of your program you encounter the same documents under other names. Table 3 shows how everything fits together.

The extra column "Other common names" shows terms you encounter in industry, in other courses, or in methodologies such as IEEE, SDM and DSDM. The names differ, but the underlying distinction is always the same: *what* must the system do (analysis/specification) versus *how* is the system built (design). Incidentally, that distinction is relative: one layer's "how" is the next layer's "what" — that is inherent to the decomposition of complex systems.

*Table 3*: Year 1 documents, SGB chapters and other common names.

| Year 1 document                                   | SGB chapter                            | Other common names                                                                                                     | Key question |
| ------------------------------------------------- | -------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- | ------------ |
| Assignment description / client interview         | 1. Context                             | Project charter, Terms of Reference                                                                                    | Why?         |
| Analysis document (functional requirements, use cases) | 2. Functional Overview            | Software Requirements Specification (SRS, IEEE 830), Functional Design (FD, SDM/DSDM), Requirements Document           | What?        |
| Design document (technical choices, class diagram) | 6. Software Architecture / 7. Design Decisions | Software Design Document (SDD, IEEE 1016), Technical Design (TD, SDM/DSDM), Architecture Document             | How?         |

The difference with year 1: there these were separate documents that you submitted separately. In the SGB they are together, so that the coherence is visible. If your architecture changes, you immediately see whether that has consequences for the functional description or the quality requirements.

### 4.4 What do we fill in during this course?

Table 4 shows which SGB chapters you work on in this course.

*Table 4*: SGB chapters per week in this course.

| Week | SGB chapter | Activity |
|------|-------------|----------|
| 5 | 1. Context | Describe the context of your system |
| 5 | 2. Functional Overview | Describe the main functionality |
| 6–7 | 13. Decision Log | Write ADRs (Architecture Decision Records) for your design choices |
| 8 | 3. Quality Attributes | Name relevant quality requirements |
| 8 | 6. Software Architecture | Create a C4 container diagram |

### 4.5 What comes later?

The chapters in Table 5 we do not yet fill in during this course, but they become relevant in later phases of your studies and career.

*Table 5*: SGB chapters for later phases.

| SGB chapter                 | When relevant                          | Why later                                                                                                              |
| --------------------------- | -------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| 4. Constraints              | 3rd year (projects with real clients)  | In this course the constraints are given in advance (language, framework, case, possibly deadlines). In projects with external clients you have to inventory and document the constraints yourself. |
| 5. Principles               | 3rd year / internship                  | You already apply principles such as SOLID in this course, but choosing and weighing the design principles for a system yourself requires more design experience. The patterns you use, you describe in chapter 7. Code; there you can also state which principle a pattern supports. |
| 7. Code                     | Partly in this course (ADRs on code organization) | Here you describe the code organization and the patterns you apply, such as the controller-service-repository layers. A more extensive description suits larger projects. |
| 8. Data                     | 2nd year                               | The film festival app already has a database, but this course does not focus on data persistence. You also worked with a database in year 1; data modeling and management return in the 2nd year. |
| 9. Infrastructure Architecture | 3rd year / internship               | Only relevant when you deploy systems on real infrastructure (cloud, on-premise).                                      |
| 10. Deployment              | 3rd year / internship                  | Deployment documentation is relevant as soon as you bring systems into production.                                     |
| 11. Operation & Support     | Internship / graduation / industry     | Monitoring, logging and maintenance procedures belong to systems that actually run for users.                          |
| 12. Development Environment | Partly in this course (READMEs)        | A complete description suits projects with a complex local setup.                                                      |

The goal is that by the end of your studies you can write a complete SGB. In this course you lay the foundation.

## 5. Continuous Documentation

This chapter starts with the problem of documentation after the fact (5.1) and contrasts it with the solution: updating documentation and code at the same time (5.2). Section 5.3 shows how that works in practice, and section 5.4 why it works.

### 5.1 The problem with "documentation afterwards"

The traditional approach — first write code, then document — almost always leads to outdated documentation. The code changes, but nobody updates the document. After a few sprints the documentation no longer matches reality.

### 5.2 The solution: documentation and code at the same time

Continuous Documentation means that you update documentation and code at the same time, in the same commit or merge request. Concretely:

- When you make an architecture decision, you immediately write an ADR.
- When you change an API, you update the Functional Overview in the same MR.
- When you add a new component, you update the architecture diagram in the same commit.

Theunissen describes this way of working as essential for maintaining documentation quality: documentation that you do not keep in sync with the code inevitably becomes outdated (Theunissen, 2023).

### 5.3 How does that work in practice?

In this course we apply Continuous Documentation as follows:

1. **One MR, one story.** If your merge request contains a new feature, the same MR also contains the corresponding documentation update.
2. **Review includes documentation.** In a code review you also check whether the documentation matches the code.
3. **The SGB is a living document.** Your Software Guidebook grows along with your project — it is never "finished" and never "outdated" as long as you keep it up to date.

### 5.4 Why this works

The threshold for updating documentation is lowest at the moment you write the code. At that moment you know exactly *what* you changed and *why*. A week later you have forgotten. Continuous Documentation makes use of that momentum.

## 6. Practical tips

This chapter gives three short tips: write for your future self (6.1), record design choices in ADRs (6.2) and keep it short (6.3).

### 6.1 Write for your future self

Imagine reading back your own code in six months. What would you want to know then? Write that down. Not the implementation details (those are in the code), but the *context* and the *rationale*.

### 6.2 Use ADRs for design choices

An Architecture Decision Record (ADR) records one decision in a short, structured format:

- **Context** — What is the situation? Which problem are you solving?
- **Decision** — What did you choose?
- **Consequences** — What are the advantages and disadvantages of this choice?

ADRs are valuable because they record the *why*. Code shows *what* you built; an ADR explains *why* you built it this way and not another.

### 6.3 Keep it short

Good documentation is short and to the point. One page that hits the core is more valuable than ten pages nobody reads. Write down only what the reader needs to understand the system or work on it.

## 7. Referencing and APA in technical documentation

This chapter describes how to cite sources correctly in technical documentation. Section 7.1 explains what an SGB is *not* — not teaching material for beginners, but references to what you used and why. Section 7.2 clarifies the difference between a reference list and a bibliography. Section 7.3 describes the APA style we use at HAN. Section 7.4 covers referencing online community sources (StackOverflow, Medium, Reddit). Section 7.5 describes common mistakes in APA references.

### 7.1 What an SGB is not

Technical documentation accompanying code (such as a Software Guidebook, or FD/TD or SRS/SDD) is not a course for beginners. You are not going to explain the basic principles of React or Spring Boot, and not write a tutorial on conditionals or while loops. You assume the reader knows that.

What you do do:

- Describe *how* you have deployed existing frameworks and techniques
- Which choices you (as a team) made while building the software and why (ADRs)
- Which principles were leading and their relative priorities
- Enable the reader to dig deeper: state which knowledge you assume and give pointers to relevant sources (e.g. the Angular Style Guide, react.dev, a specific chapter from a book)

An SGB is not a "talk about Spring Boot" but rather "here is how this application fits together, which technologies are used, and where you can read more."

### 7.2 Reference list vs. bibliography

A reference list contains only sources that you refer to from the text. If you do not refer to a source in the text, it does not belong in the reference list — that is a bibliography (recommended reading list). Such a list can be useful, but it stands separately, not as "References" at the end.

Microsoft Word calls the automatically generated section "Bibliography" by default. That is technically correct for Word's function (it generates a list of everything you have entered), but for an SGB or technical document you have to filter yourself: only sources you actually cite in the text belong in the reference list.

The balance: describe what is *specific* to your system, and for what is *generic* refer to existing sources. If the assumption is that the reader already knows everything, nobody reads your documentation. But if your documentation only rehashes basic knowledge that is available everywhere online, you are writing useless documentation.

### 7.3 APA in technical documentation

At HAN we use APA style: author and year in parentheses in the text, full reference in the reference list at the end. In the reference list you give the full date, title, and for online sources a URL. For books: page number and publisher.

### 7.4 References to online community sources

Online community sources (StackOverflow, Medium, Reddit, Dev.to) are a legitimate form of *community research* (ICT Research Methods, n.d.). Structurally excluding a platform is a form of bias — judge a source on its content, not on the platform it is on.

What does apply: the platform is NOT the author. The author is the person who wrote the answer or post. This holds for StackOverflow, but equally for a blog post on Medium or a thread on Reddit. So do NOT put the platform as the author's name (a frequently made mistake).

#### 7.4.1 Anti-pattern 1: platform as author

Wrong: `StackOverflow. (2021). *Is it common to...?*`

Right: `bitfox. (2021). Answer to *Is it common to...?* [StackOverflow].`

The platform (StackOverflow, Medium.com, Dev.to) is the *medium*, NOT the author. Use the username of the answerer. If only a first name or alias/avatar is known, use that as the surname in the reference (Swaen, 2024).

A possible objection is: "But nobody knows who `bitfox` is; that is only an alias and thus not an authoritative source." That may be true. Then the solution is not to give `StackOverflow` as the author, but to leave this source out or to look for a better source with a better quote. Sometimes you can verify the author behind an alias via the profile. Jon Skeet, for example, is a well-known C# developer and author, but also an avid StackOverflow poster; in 2018 he became the first user to pass a million reputation points (Larsen & Silge, 2018). That makes his answers more traceable than an unknown alias. For `bitfox` that does not hold; they are and remain anonymous, but their answer is the selected StackOverflow answer.

#### 7.4.2 Anti-pattern 2: title as in-text reference

Wrong: "...is discouraged (*Is it common to dedicate a git branch for a separate project?*, 2021)."

Right: "...is discouraged (bitfox, 2021)."

Always use the author's name in the in-text reference, not the title of the piece.

#### 7.4.3 Format for a StackOverflow answer

```text
Author. (year). Answer to *Question title* [StackOverflow].
  URL
```

Example:

```text
bitfox. (2021). Answer to *Is it common to dedicate a git branch
  for a separate project?* [StackOverflow]. Retrieved from
  https://stackoverflow.com/questions/67517650/ 
```

### 7.5 Common mistakes in APA referencing

#### 7.5.1 Footnotes for referencing

APA does not use footnotes for source references.[^2] You may use footnotes for additional explanation, but source references are placed inline in the text as (Author, year), not as a footnote at the bottom of the page.

[^2]: This is an example of a footnote. A footnote contains optional explanation — not essential information. Do not make a footnote consist of just a URL such as `https://spring.io`, because that is not APA. You can cite a source within a footnote: "The widely used APA style prescribes that you do not use footnotes to cite sources" (Swaen, 2013).

#### 7.5.2 Do not use IEEE references (but APA)

In scientific papers you also see the IEEE standard with square brackets and numbers: [1], [2], [3]. That is not wrong in itself — it is a different system, but using it at HAN is in principle wrong. At HAN we choose APA, and APA has the objective advantage that it makes author and year directly visible in the text, without the reader having to scroll to a numbered list. You know whether it is recent or not, and recognize a trusted author, or get to know one. A disadvantage of APA can be, for example, that you order sources alphabetically, so the reference list is in a different order than the references appear in the text, which is not the case with IEEE.

If you have good reasons to want to use another standard such as IEEE instead of APA, discuss this with your supervisors. Much is possible in consultation.

#### 7.5.3 The (round) parentheses rule

A reference in parentheses is grammatically an optional part of the sentence. The sentence must be correct both with and without the part in parentheses.

Wrong: "(Minto, 2009) says that you should write documents in a structured way." (Without parentheses: "says that you..." — no subject.)

Right: "Minto (2009) says that you should write documents in a structured way." (Without parentheses: "Minto says that you..." — correct.)

Right: "Documents should be structured (Minto, 2009)." (Without parentheses: "Documents should be structured." — correct.)

#### 7.5.4 Tools do not relieve you of responsibility

Microsoft Word calls the section "Bibliography" by default — but that fact does not make it correct for your document. The same goes for APA tools such as those on the Scribbr website or the built-in referencing in Word: if you enter the wrong information, the tool generates a neat but incorrect reference. You are ultimately responsible for correctness yourself, just as when using AI as a writing aid.

## References

- Brakel, V. van. (2021, February 17). *Tips voor het schrijven van alternatieve beschrijvingen van afbeeldingen* [Tips for writing alternative descriptions of images]. Digitaal Toegankelijk. Retrieved June 2026, from https://digitaaltoegankelijk.nl/nieuws/tips-voor-het-schrijven-van-alternatieve-beschrijvingen-van-afbeeldingen/
- Brown, S. (2022). *Software Architecture for Developers*. Leanpub. https://leanpub.com/software-architecture-for-developers
- Brown, S. (n.d.). *The C4 model for visualising software architecture*. https://c4model.com/
- Fowler, M. (2019). *Software architecture guide*. https://martinfowler.com/architecture/
- Google. (2025, March 28). *Technical Writing One: Active voice vs. passive voice*. https://developers.google.com/tech-writing/one/active-voice
- Google. (n.d.-a). *Technical Writing One: Lists and tables*. https://developers.google.com/tech-writing/one/lists-and-tables
- Google. (n.d.-b). *Technical Writing Two: Illustrations*. https://developers.google.com/tech-writing/two/illustrations
- IBM. (n.d.). *Passive voice*. IBM Engineering Requirements Quality Assistant documentation. Retrieved October 2, 2026, from https://www.ibm.com/docs/en/erqa?topic=scores-passive-voice
- ICT Research Methods. (n.d.). *Community Research*. Retrieved June 2026, from https://ictresearchmethods.nl/library/community-research/
- Larsen, N., & Silge, J. (2018, January 15). *Thanks a Million, Jon Skeet!* Stack Overflow Blog. https://stackoverflow.blog/2018/01/15/thanks-million-jon-skeet/
- Martin, R. C. (2008). *Clean Code: A Handbook of Agile Software Craftsmanship*. Prentice Hall. Chapter 1 also available at https://www.informit.com/articles/article.aspx?p=1235624
- Martin, R. C. (2011, September 30). *Screaming architecture*. The Clean Code Blog. https://blog.cleancoder.com/uncle-bob/2011/09/30/Screaming-Architecture.html
- Merkus, J. (2022, November 18). *Bijlagen* [Appendices]. Scribbr. https://www.scribbr.nl/apa-stijl/bijlagen/
- Microsoft. (n.d.). *Create a README for your Git repo*. Azure DevOps Documentation. Retrieved June 2026, from https://learn.microsoft.com/en-us/azure/devops/repos/git/create-a-readme
- Minto, B. (2009). *The pyramid principle: Logic in writing and thinking* (3rd ed.). Pearson Education.
- Schweppe, J., Eitel, A., & Rummer, R. (2015). The multimedia effect and its stability over time. *Learning and Instruction*, *38*, 24–33. https://doi.org/10.1016/j.learninstruc.2015.03.001
- Sung, E., & Mayer, R. E. (2012). When graphics improve liking but not learning from online lessons. *Computers in Human Behavior*, *28*(5), 1618–1625. https://doi.org/10.1016/j.chb.2012.03.026
- Swaen, B. (2013, February 13). *Voetnoten in een scriptie* [Footnotes in a thesis]. Scribbr. https://www.scribbr.nl/scriptie-tips/voetnoten-in-een-scriptie/
- Swaen, B. (2024, August 22). *Uitzonderingen verwijzingen in de tekst volgens de APA-regels* [Exceptions to in-text references according to the APA rules]. Scribbr. https://www.scribbr.nl/apa-stijl/uitzonderingen-verwijzingen-de-tekst-volgens-de-apa-regels/
- Theunissen, T. (2023). *Software documentation: How to capture design decisions*. HAN University of Applied Sciences. [Specific article/chapter to be verified — the claim concerns recording rationale in commits and pull requests.]
- Vleeshouwers, L. (2024, June 24). *De lijdende of passieve vorm: wordt deze goedgekeurd of juist niet?* [The passive voice: is it approved or not?]. Scribbr. https://www.scribbr.nl/taalregels-schrijftips/de-lijdende-vorm/
- Wal, B. van der. (2025, December 22). *Bronvermelding in ICT* [Referencing in ICT]. Personal blog. https://bartvanderwal.nl/bronvermelding-in-ict/
