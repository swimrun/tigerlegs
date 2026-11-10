# 14. Back-end technology

Date: 2026-11-10

## Status

Draft. No decision has been taken; this record sets up the multi-criteria comparison for issue #13 (and #6). The weights and the familiarity scores (C1) are the owner's to set; every other score is provisional and says how it was obtained. It builds on [ADR-0002](./0002-use-deno-with-typescript.md), [ADR-0004](./0004-host-deno-backend-on-eu-vps.md), [ADR-0005](./0005-rest-json-api-for-multi-client-support.md) and [ADR-0013](./0013-back-end-is-optional.md). A change in the situation of Deno (below) also puts ADR-0002 itself up for review (#61).

## Context

The back end is optional and a premium feature ([ADR-0013](./0013-back-end-is-optional.md)): saved and shared courses, a hosted terrain service on our own Overpass server (#57), the MCP server and Strava integration ([ADR-0010](./0010-tigerlegs-mcp-server-and-strava-integration.md)) and training plans (spec 003).
It runs as a container on a small EU VPS (ADR-0004).
Today it is a small Deno service with a disk cache; ADR-0002 chose Deno and TypeScript for the whole project, when the server needs were minimal.
Issue #13 asks whether that holds once persistence, accounts and external APIs come in.

### Overpass does not decide the language

The Overpass API is plain HTTP: a POST with a query in Overpass QL, answered with JSON (OpenStreetMap Wiki, n.d.-a, n.d.-b).
The example on the wiki uses `fetch` in JavaScript, but any language that can send an HTTP request can do the same; there is no JavaScript-only Overpass API.
The advantage TypeScript has here is different: the browser already contains the working client (`queryOverpass`, with backoff and cache), and a TypeScript back end could reuse it and the water-detection code.
That is a code-sharing argument (C4), not an Overpass argument.

### Deno after October 2026

On 9 October 2026 Cloudflare announced that Deno joins it: Ryan Dahl and Bert Belder lead an effort to merge Deno's `celld` into Cloudflare's `workerd` and to make self-hosting of the Workers programming model a first-class option (Cloudflare, 2026).
For the Deno runtime itself, a Deno team member states in the project's issue tracker (Deno, 2026): the runtime stays MIT licensed and forkable; the Deno Company maintains it until October 2027 with monthly 2.9.x LTS releases (bug and security fixes); no new features are developed, and feature pull requests are closed; the team is trying to place Deno in a foundation but has nothing to report.
Heise reports that Deno Deploy shuts down after six months, that the JSR package registry keeps running on Cloudflare's infrastructure, and that JSR's community governance is now unclear (Roden, 2026).
The Deno team itself confirmed the one-year LTS period in an update on 15 October (Linuxiac, 2026). Reaction in the community is reported as strong, with forks and foundation proposals under discussion; those are early and secondary reports (Hacker News, 2026; Socket, 2026), and no fork is mature.

What this means for us:

- The runtime stays usable and open for at least a year; the risk is the time after that, and it is a risk of *stewardship*, not of licence.
- Our own exposure is moderate: 45 source and test files use `Deno.*` APIs, 38 import `@std/*` from JSR, and `deno test` and `deno task` run the tests and builds, while the site itself is built with Astro and npm. The back end is 6 files.
- Deno KV and Deno Deploy are platform services; we use neither, and we should not start. Persistence for the premium features is PostgreSQL in a container, which works the same on every option below and keeps us free to host in the EU.

### Java and .NET: what the LTS releases offer, and under which licence

- **OpenJDK or Oracle JDK.** The Oracle JDK builds are made from the same OpenJDK source; vendor and licensing write-ups find no meaningful performance difference between them and Temurin, Corretto or Zulu on the same Java version, and the difference left is the licence: OpenJDK is GPLv2 with the Classpath Exception, while Oracle JDK 17, 21 and 25 are free in production under Oracle's No-Fee Terms and Conditions, but only until a year after the next LTS (OpenLogic, n.d.). So the language and runtime features below come with the free OpenJDK distributions too; a Temurin or Corretto build avoids the licence question altogether (Adoptium, n.d.).
- **Startup time.** Project Leyden's ahead-of-time cache is part of OpenJDK itself (from JDK 24, improved in 25) and speeds up the start of a Spring Boot application without a different JDK (InfoQ, 2025; Halbritter, 2026). GraalVM Native Image compiles to a native binary instead, with a very short start and low memory; Spring Boot, Quarkus and Micronaut support it. GraalVM is a separate distribution: Oracle GraalVM is free in production under the GraalVM Free Terms and Conditions, and there is a Community Edition (GraalVM, n.d.). CRaC (a checkpointed process) is a third route, offered by some OpenJDK vendors. Published numbers differ per application and are vendor or blog figures: to be measured in our spike.
- **Project Valhalla.** Value classes (JEP 401), the Java counterpart of structs that flatten data in memory, are integrated as a *preview* feature in JDK 28 (March 2027), disabled by default, and not expected to be final even in JDK 29, the next LTS (InfoQ, 2026). They are not in Java 25 and cannot be relied upon for this decision; like everything in OpenJDK they will come to all builds.
- **.NET 10.** The .NET runtime is licensed under MIT and is a .NET Foundation project (.NET Foundation, n.d.); .NET 10 is LTS until 14 November 2028 (Microsoft, n.d.). That ASP.NET Core was far behind Java servers such as Jetty is an old picture: for years it has been at or near the top of the TechEmpower results. Those results were archived (see below), so no current neutral comparison exists for .NET 10 against Java 25, and we measure ourselves.

### Does Astro put pressure on the choice?

Little. The site is Astro in its default static mode on GitHub Pages: "By default, your entire Astro site will be prerendered, and static HTML pages will be sent to the browser", and an adapter (Node.js, Cloudflare, Netlify, Vercel) is only needed for pages rendered on demand (Astro, n.d.-a). A static site that calls a separate API needs no adapter, and in static mode Astro endpoints only run at build time (Astro, n.d.-b). So the back end is a separate service behind a REST/JSON contract (ADR-0005), and Astro does not care what it is written in.

Where pressure could appear:

- **If Astro were the back end** (on-demand rendering, endpoints or actions with a Node or Cloudflare adapter), a JavaScript runtime and a host for it would follow. That is not planned: the static site stays on GitHub Pages and the back end stays optional (ADR-0013).
- **Types shared with the islands.** A TypeScript back end can share types with the React islands directly. Any other language needs the API described first, for example in OpenAPI (Javalin, Spring Boot, ASP.NET Core and FastAPI can all produce it), and the TypeScript client types generated from that description.
- **Toolchains in the repository.** Astro and Playwright already need Node, and today Deno runs the tests. A Java, Kotlin or .NET back end adds a JDK or SDK and a build tool (Gradle or Maven) to every contributor's machine and to CI; a Node back end adds none. This is part of C4.
- **Origins and cookies.** The site lives at `swimrun.group/tigerlegs`. A back end on a subdomain of the same site (for example `api.swimrun.group`) lets sign-in cookies work without cross-site settings, and CORS is already handled (`ALLOWED_ORIGINS`). This holds for every option.

### If an LLM writes the code anyway

Raw speed does not decide this back end, which will see few requests; the interesting question is what changes when a language model writes most of the code.
It lowers the cost of writing in an unfamiliar language and so favours languages with a strong compiler (Rust, Go, Kotlin, C#, Java): the compiler catches many mistakes a model makes before they run.
It does not lower the cost of *reading*, reviewing, debugging and operating the result, which stays with the owner, and C1 is about exactly that (and the wish to get to know a language better).
Models also write best where the training data is richest, which favours TypeScript, Python, Java with Spring and C#.
Rust frameworks such as Actix and Axum are reported among the fastest in blog comparisons of the last TechEmpower round; that is not verified here and does not matter at our load.
What Rust offers at our scale is a very small image and memory use and a strict compiler; what it costs is a smaller batteries-included ecosystem for accounts and OAuth, a steeper language to review, and a library that is still pre-1.0.

## Method

The comparison follows the [ICT Research Methods multi-criteria decision making method](https://ictresearchmethods.nl/workshop/multi-criteria-decision-making/), as ADR-0009 did: a preparation phase (alternatives, criteria, weights, the stakeholders involved) and an evaluation phase (judge each option per criterion), with time to iterate between judging the options and adjusting the criteria (ICT Research Methods, n.d.).
The page gives no scoring scale or formula, so this record chooses the plain weighted sum: scores run from 1 (poor) to 5 (excellent), weights add up to 100, and the total is the sum of weight times score.
The stakeholder is the project owner (learning goals, own time, self-hosting in Europe); contributors and later coaches and organisers can be added when they exist.

## Alternatives

Only supported releases are considered: Java 25 is an LTS release, available from Temurin from September 2025 until at least September 2031 (Adoptium, n.d.); .NET 10 is an LTS release of November 2025 with support until 14 November 2028 (Microsoft, n.d.).
.NET 11 (STS) was released today and is left out for that reason.

| Option           | Language and runtime          | Reasons to consider                                                                                                                                                                                                                                |     |     |     |     |     |     |         |
| ---------------- | ----------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --- | --- | --- | --- | --- | --- | ------- |
| **Deno** (now)   | TypeScript on Deno            | Same language as the front end; already built, tested and containerised; MIT; but see above                                                                                                                                                        |     |     |     |     |     |     |         |
| **Node.js**      | TypeScript on Node.js         | Same language as the front end; the largest ecosystem; the site build already uses npm; OpenJS Foundation governance                                                                                                                               |     |     |     |     |     |     |         |
| **FastAPI**      | Python                        | Readable, well known, strong for data work later                                                                                                                                                                                                   |     |     |     |     |     |     |         |
| **Spring Boot**  | Java 25 LTS                   | Batteries for accounts, persistence and OAuth; the named alternative in #13; several independent OpenJDK vendors; the owner wants to get to know Java and Spring better                                                                            |     |     |     |     |     |     |         |
| **Micronaut**    | Java 25 LTS                   | A framework aimed at small services: dependency injection at build time, lower memory, native image support; a smaller community than Spring                                                                                                       |     |     |     |     |     |     |         |
| **Quarkus**      | Java 25 LTS                   | A framework aimed at small services and containers: build-time optimisation, fast start with native image or Leyden (Quarkus, n.d.); a smaller community than Spring                                                                               |     |     |     |     |     |     |         |
| **Javalin**      | Kotlin or Java on Java 25 LTS | A small framework in the style of Express: few concepts, routes and handlers, on top of Jetty, Apache 2.0, equal support for Kotlin and Java, optional virtual threads and OpenAPI (Javalin, n.d.); you assemble accounts and persistence yourself |     |     |     |     |     |     |         |
| **ASP.NET Core** | C# on .NET 10 LTS             | Mature web stack, strong tooling, open source; Native AOT for small and fast containers                                                                                                                                                            |     |     |     |     |     |     |         |
| **Go**           | Go                            | Small static binary, very light on a small VPS                                                                                                                                                                                                     |     |     |     |     |     |     |         |
| Axum             | 4                             | 5                                                                                                                                                                                                                                                  | 1   | 3   | 5   | 4   | 5   | 4   | **315** |
| **Axum**         | Rust                          | A Rust web library on hyper and tower, MIT, maintained by the Tokio project; among the fastest web stacks, tiny memory and image; pre-1.0 (0.8 on crates.io) (Tokio, n.d.)                                                                         |     |     |     |     |     |     |         |

## Criteria and weights (draft)

| #   | Criterion                                                            | Weight | What it asks                                                                                                                                                    |
| --- | -------------------------------------------------------------------- | ------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| C1  | Accessible language the owner knows or wants to learn or know better | 20     | Familiarity and learning value (the owner's own score)                                                                                                          |
| C2  | Fit with external HTTP APIs such as Overpass                         | 10     | HTTP client, JSON, retry and cache libraries                                                                                                                    |
| C3  | Light on a small VPS                                                 | 15     | Image size, idle memory, start time                                                                                                                             |
| C4  | Shares code with the front end                                       | 10     | Reuse of the TypeScript client, types and analysis code (weight 0 if the back end never analyses GPX)                                                           |
| C5  | Ecosystem for premium features                                       | 10     | Accounts, OAuth for Strava and MCP, a database, payments                                                                                                        |
| C6  | Tooling and testing                                                  | 5      | Tests, lint, format, container workflow                                                                                                                         |
| C7  | Security and supply chain                                            | 5      | Permissions, dependency trust                                                                                                                                   |
| C8  | Autonomy                                                             | 15     | Self-hostable in the EU on our own infrastructure; no lock-in to one vendor's platform services; open licence and governance not controlled by a single company |
| C9  | Long-term health                                                     | 10     | Support timeline, who maintains it, size of the community                                                                                                       |

C8 is named *autonomy* here. *Sovereignty* is also used for this idea, but the word has other uses; what is meant is the ability to run, move and fix our own service without asking a vendor.

## Evaluation (provisional)

Scores 1 to 5. C1 is left to the owner. The C3 score of Deno is measured; the other C3 scores are estimates to be measured in a spike. The rest are judgements from the reasons above and open to challenge; C8 and C9 for Deno reflect the events of October 2026: the objective reason is not that Cloudflare owns it (the runtime stays MIT and forkable) but that its own maintainers stop developing it after October 2027 unless a foundation or a fork takes over. Until then Deno remains a usable choice with monthly security and bug-fix releases; the owner can weigh C9 lower.

| Option       | C2 (10) | C3 (15) | C4 (10) | C5 (10) | C6 (5) | C7 (5) | C8 (15) | C9 (10) | Subtotal (80) |
| ------------ | ------- | ------- | ------- | ------- | ------ | ------ | ------- | ------- | ------------- |
| Deno         | 5       | 4       | 5       | 3       | 4      | 4      | 3       | 1       | **285**       |
| Node.js      | 5       | 4       | 5       | 5       | 4      | 3      | 5       | 5       | **370**       |
| FastAPI      | 4       | 3       | 1       | 4       | 4      | 3      | 5       | 5       | **295**       |
| Spring Boot  | 4       | 2       | 1       | 5       | 4      | 4      | 5       | 5       | **295**       |
| Micronaut    | 4       | 3       | 1       | 4       | 4      | 4      | 5       | 4       | **290**       |
| Quarkus      | 4       | 3       | 1       | 4       | 4      | 4      | 5       | 4       | **290**       |
| Javalin      | 4       | 3       | 1       | 3       | 4      | 4      | 5       | 4       | **280**       |
| ASP.NET Core | 4       | 3       | 1       | 5       | 4      | 4      | 4       | 5       | **295**       |
| Go           | 4       | 5       | 1       | 3       | 5      | 4      | 4       | 5       | **310**       |

Measured for Deno on 2026-11-10: the API image is 117 MB and the idle container uses 21.7 MiB of memory (`docker stats`, no traffic, health endpoint answering).

### Performance of the LTS releases

There is no neutral, current cross-framework benchmark to lean on: the TechEmpower Framework Benchmarks were archived on 24 March 2026, and their last round (23, February 2025) predates both .NET 10 and Java 25 (Kalium, 2026).
Blog posts claim that .NET 10 reaches start times under 100 ms with Native AOT and that Java's Project Leyden AOT cache cuts Spring Boot's start by half or more; those are secondary claims that we have not verified.
For this back end, raw throughput hardly matters: it will see few requests.
What matters is the idle memory, the image size and the start time in a container, and those are measured, not read off a benchmark: the spike below builds the same small service (health endpoint plus one Overpass query with backoff) on each shortlisted option.

### The total

Total = subtotal + 20 × C1. A point of familiarity is worth 20 points, so the owner's scores can add 20 to 100 points to each option.
On the provisional scores Node.js leads the others by 60 points or more, and Deno trails Node.js by 85, mostly because of C9 and C8.
Another option only passes Node.js if the owner rates it about three points higher on C1; Go, Spring Boot and .NET are within 75 to 85 points of Node.js and so need that gap or better scores in the spike.

## Sensitivity

- If the back end never analyses GPX (C4 weight 0, its 10 points to C1), the TypeScript options lose their edge and the owner's preference decides between Node.js, Go, .NET and Java.
- If memory on the VPS must stay very small (C3 weight 25), Go and Deno gain, Java loses unless the measured start and idle numbers say otherwise.
- If autonomy and governance are weighed even higher (C8 and C9 together 35), Deno falls further.
- If premium features need a full user and payment stack soon (C5 weight 20), Node.js, Java and .NET gain.

## Next steps

1. The owner sets the C1 scores (and corrects the weights), then the totals are computed.
2. A spike per surviving option measures C3 and tries one real task: the Overpass query with backoff and a cache, plus a health endpoint, in a container.
3. Iterate between the scores and the criteria, as the method asks, then record the decision (this ADR becomes Proposed) and the fate of ADR-0002 (#61).

## References

- Adoptium. (n.d.). *Temurin support and roadmap*. Retrieved November 10, 2026, from https://adoptium.net/support/
- Cloudflare. (2026, October 9). *Deno joins Cloudflare*. https://blog.cloudflare.com/deno-joins-cloudflare
- Deno. (2026). *The state of Deno after the Cloudflare announcement* (Issue 37030) [Issue tracker]. GitHub. Retrieved November 10, 2026, from https://github.com/denoland/deno/issues/37030
- Hacker News. (2026). *Cloudflare acquires Deno* [Discussion]. Retrieved November 10, 2026, from https://news.ycombinator.com/item?id=50019911
- ICT Research Methods. (n.d.). *Multi-criteria decision making*. Retrieved November 10, 2026, from https://ictresearchmethods.nl/workshop/multi-criteria-decision-making/
- Kalium. (2026). *TechEmpower Framework Benchmarks are now archived: What's next?* DEV Community. Retrieved November 10, 2026, from https://dev.to/kaliumhexacyanoferrat/techempower-framework-benchmarks-are-now-archived-whats-next-3l0a
- Microsoft. (n.d.). *.NET and .NET Core official support policy*. Retrieved November 10, 2026, from https://dotnet.microsoft.com/en-us/platform/support/policy/dotnet-core
- OpenStreetMap Wiki. (n.d.-a). *Overpass API*. Retrieved November 10, 2026, from https://wiki.openstreetmap.org/wiki/Overpass_API
- OpenStreetMap Wiki. (n.d.-b). *Overpass API/Overpass QL*. Retrieved November 10, 2026, from https://wiki.openstreetmap.org/wiki/Overpass_API/Overpass_QL
- Roden, G. (2026). *Commentary: Deno joins Cloudflare — judged by its own promises*. heise online. Retrieved November 10, 2026, from https://www.heise.de/en/blog/Commentary-Deno-joins-Cloudflare-judged-by-its-own-promises-11509407.html
- Socket. (2026). *Deno goes the way of the dinosaur*. Retrieved November 10, 2026, from https://socket.dev/blog/deno-acquisition

Astro. (n.d.-a). *On-demand rendering*. Retrieved November 10, 2026, from https://docs.astro.build/en/guides/on-demand-rendering/

Astro. (n.d.-b). *Endpoints*. Retrieved November 10, 2026, from https://docs.astro.build/en/guides/endpoints/

GraalVM. (n.d.). *Downloads*. Retrieved November 10, 2026, from https://www.graalvm.org/downloads/

Halbritter, M. (2026, February). *Supercharge your JVM performance with Project Leyden and Spring Boot* [Slides]. https://mhalbritter.github.io/slides/2026-02%20-%20Supercharge%20your%20JVM%20performance%20with%20Project%20Leyden%20and%20Spring%20Boot.pdf

InfoQ. (2025, March). *Java 24 ships Project Leyden*. https://www.infoq.com/news/2025/03/java-24-leyden-ships

InfoQ. (2026, August). *JEP 401 value objects preview*. https://infoq.com/news/2026/08/jep401-value-objects-preview

Javalin. (n.d.). *Javalin: A simple web framework for Java and Kotlin*. Retrieved November 10, 2026, from https://javalin.io/

Linuxiac. (2026). *Cloudflare acquires Deno JavaScript runtime, core development to end in 2027*. https://linuxiac.com/cloudflare-acquires-deno-javascript-runtime/

.NET Foundation. (n.d.). *dotnet/runtime* [Repository and licence]. GitHub. Retrieved November 10, 2026, from https://github.com/dotnet/runtime

OpenLogic. (n.d.). *Java experts on OpenJDK vs. Oracle JDK*. https://www.openlogic.com/blog/java-experts-openjdk-vs-oracle-jdk

Quarkus. (n.d.). *How we integrated Project Leyden into Quarkus*. Retrieved November 10, 2026, from https://quarkus.io/blog/leyden-2/

Tokio. (n.d.). *axum* [Repository and README]. GitHub. Retrieved November 10, 2026, from https://github.com/tokio-rs/axum
