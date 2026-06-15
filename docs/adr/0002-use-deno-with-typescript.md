# 2. Use Deno with TypeScript as runtime and language

Date: 2026-06-15

## Status

Accepted

## Context

We need to choose a runtime and language for building a web-based
GPX-to-swimrun-segments tool. The tool is primarily client-side
(GPX parsing, Haversine distance calculation, Leaflet map rendering)
with minimal server-side requirements (static file serving).

Candidates considered:
- Node.js + npm + TypeScript
- Deno + JSR + TypeScript
- Python (Flask/Django)
- Java (Spring Boot)
- Vanilla HTML/JS (no runtime)

## Options

### Deno + TypeScript (chosen)

- Native TypeScript support without a build step
- Secure-by-default (no file/network access unless explicitly granted)
- Built-in tooling: `deno test`, `deno lint`, `deno fmt`
- JSR package registry with better supply chain security than npm
- Standard library covers most utility needs without third-party deps
- URL-based imports with lock files mitigate dependency attacks

### Node.js + npm + TypeScript

- Largest ecosystem, most library choices
- Requires separate TypeScript compilation step (tsc or bundler)
- npm supply chain attacks are a known and growing risk
- Requires additional tooling setup (Jest/Vitest, ESLint, Prettier)

### Python (Flask/Django)

- Unnecessary server round-trip for client-side operations
- Django ORM/admin irrelevant for this use case
- Adds deployment complexity for a static-first tool

### Java (Spring Boot)

- Heavy for a lightweight open-source tool
- No database, no auth, no multi-user state to justify it

### Vanilla HTML/JS (no runtime)

- Smallest attack surface, zero dependencies beyond Leaflet CDN
- No component model, harder to test in isolation
- No type safety

## Decision

We will use Deno as the runtime with TypeScript as the language.
The core GPX parsing and distance logic will be a standalone module
publishable to JSR. The web UI will be a static site or Deno Fresh
app that imports the core module.

## Consequences

- All source files use `.ts` extension
- `deno.json` serves as project configuration (equivalent to
  package.json)
- No `node_modules` directory
- Third-party dependencies imported via URL or JSR specifiers
- CI/CD uses `deno` commands directly
- Contributors need Deno installed (not Node.js)

## References

- Deno. (n.d.). *Deno runtime documentation*. https://deno.land/
- JSR. (n.d.). *The JavaScript Registry*. https://jsr.io/
