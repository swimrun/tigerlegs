# Vite+ (VP): summary and advice for TigerLegs

This note summarises Vite+ from a video and from the project's own documentation, and advises how it could fit TigerLegs (issue #78).
It is not a decision: a decision record follows once the owner has tried `vp migrate` on a branch.
Statements that are not verified are marked "to check".

## What Vite+ is

The video starts from the observation that every web application has the same components: linting, formatting, testing and a bundler, next to a package manager, continuous integration, Git hooks and, for libraries, a library builder (Web Dev Simplified, 2026).
Vite+ takes all of these and, in the presenter's words, is "combining them into one project", configured in one place (Web Dev Simplified, 2026).
Under one command, `vp`, it bundles:

- **Bundler and dev server:** Vite.
- **Tests:** Vitest ("pretty much exactly the same as Jest").
- **Linting and formatting:** Oxlint and Oxfmt, Rust tools that aim to be close to ESLint and Prettier, with type-aware linting and type checking switched on in the generated config.
- **Package manager:** a wrapper over npm, pnpm or another manager that the project defines, and a runtime manager (`vp env`) that pins Node versions per project.
- **Git hooks and CI:** a pre-commit step that runs `vp check` on staged files, and a CI setup action.
- **Library packing, generators and monorepo support.**

"Everything that we need to be able to configure is inside this one file", the `vite.config.ts` (Web Dev Simplified, 2026).
The presenter's argument for AI-written code is that the pre-commit check refuses code that does not lint, format and type check, and that built-in tests give an AI a test suite to work against.

## The commands

| Command                      | What it does                                                                          |
| ---------------------------- | ------------------------------------------------------------------------------------- |
| `vp create`                  | New project: application, library or monorepo, or a template such as `vp create vite` |
| `vp dev`, `build`, `preview` | The Vite dev server, build and preview                                                |
| `vp check`                   | Lint, format check and type check in one run; `vp lint` and `vp format` separately    |
| `vp test`                    | Vitest, with `watch` and `--coverage`                                                 |
| `vp pack`                    | Packs a library or an executable                                                      |
| `vp install`, `outdated`     | Installs and inspects packages with the project's package manager                     |
| `vp run <script>`            | Runs a `package.json` script; `vpx` replaces `npx`                                    |
| `vp env`                     | Shows and pins the Node and package manager versions of the project                   |
| `vp migrate`                 | Moves an existing project to Vite+                                                    |

## Facts beyond the video

- **Licence and status.** Vite+ is MIT licensed, and 1.0 was released on 14 October 2026 as "a stability milestone rather than a finished product": remote caching, deeper monorepo diagnostics and `vp release` and `vp docs` commands are planned (InfoQ, 2026).
- **Owner.** VoidZero, the company behind Vite, Vitest, Rolldown, Oxc and Vite+, was acquired by Cloudflare, announced on 4 June 2026; Cloudflare committed to keep them MIT licensed and to fund an independent Vite ecosystem fund (Cloudflare, 2026; as reported in the search summaries, to check in the announcement).
- **Requirements.** `vp migrate` needs Node `^22.18.0 || ^24.11.0 || >=26.0.0` and works with npm, pnpm and yarn (VoidZero, n.d.).
- **What `vp migrate` does.** It "updates project dependencies", "rewrites imports where needed", "merges tool-specific config into `vite.config.ts`" and "updates scripts to the Vite+ command surface"; it recommends a fresh branch and, for existing projects, "upgrade to Vite 7+ and Vitest 4+ first" (VoidZero, n.d.).
- **Limits.** "Migration does not automatically convert Husky setups", it must run at the workspace root, and "most projects will require further manual adjustments after running `vp migrate`" (VoidZero, n.d.). The video agrees: "pretty much any large project is not going to be a onetoone conversion, but this at least gives you a good starting point" (Web Dev Simplified, 2026).

## What `vp migrate` would do to TigerLegs

What the repository has today, checked on 11 November 2026: Astro 7 on Vite 8.3.5, Vitest 5.0.5 (for the Storybook tests, in a browser), TypeScript 5.9, Node 24 in `.nvmrc`, npm and a `package-lock.json`, no ESLint, no Prettier and no Husky; `deno lint` and `deno fmt` are the linter and formatter, and Deno runs 452 unit tests, the build scripts and the documentation scripts.

- **Prerequisites are met.** Vite 8 and Vitest 5 are above the Vite 7+ and Vitest 4+ that the guide asks for, and Node 24 is supported.
- **A first formatting commit.** The video's example without a formatter got one added and "found formatting issues in 24 files" (semicolons); expect the same here, since `deno fmt` and Oxfmt differ. Two formatters in one repository is not workable: choose one.
- **Rewritten Vitest imports.** The guide converts test imports from `vitest` to `vite-plus/test`. Our `vitest.config.ts` and the Storybook addon (`@storybook/addon-vitest`) import from `vitest`; whether they keep working after the rewrite is to check.
- **Astro.** The video migrated an Astro project and had to fix an Astro lint plugin rule by hand, and added a TypeScript shim for Astro components. We have no ESLint plugin to convert. Astro runs on Vite, so there is no fundamental conflict, but `astro dev` and `astro build` should stay the commands of the site, because Astro drives Vite itself; whether `vp dev` and `vp build` can replace them is to check.
- **Deno stays untouched.** `vp migrate` does not know Deno: the 42 files with 466 `Deno.test` calls, `deno.json` and the Deno scripts need their own move (below).

## Does it conflict with Astro?

No fundamental conflict is known: Astro is built on Vite and Vite+ wraps Vite, and the video shows an Astro project migrated, with one plugin problem.
Keep Astro. Use Vite+ for linting, formatting, testing, the Node version and package commands, and keep `astro dev` and `astro build` for the site until `vp dev` and `vp build` are shown to work with it.
Astro 7 with Vite+ is not documented in the sources read, so this is to check by trying.

## Ownership

Cloudflare now owns the company behind Vite, Vitest, Oxc and Vite+, and also Astro and Deno (ADR-0014, section on Astro; Cloudflare, 2026).
Our site already depends on Vite (through Astro and Storybook) and on Vitest, so Vite+ adds no new owner. It does add a `vp` layer and Oxc tools on top, which strengthens the dependence on one vendor, ADR-0014's criterion C8 (autonomy).
What limits the risk: everything is MIT licensed and forkable, `vp` is a thin command surface over tools that also run on their own (Vite, Vitest, Oxlint, Oxfmt), and the repository can leave again by putting the scripts back.
This is a trade-off for the owner to weigh, not a blocker.

## Advice

1. **Do not run `vp migrate` on `main`.** Run it on a branch and read the diff, as the guide says. Use a branch in the repository, not a copy under `/tmp`.
2. **Install `vite-plus` as a project dependency**, not only globally, so that CI and every contributor use the same version; the video says both are possible. A global install by script is a supply-chain decision of its own.
3. **Move in this order**, each step with its own pull request and all test suites green:
   1. The Node back end on npm and Vitest (done in #76: `npm run server`, `test:server`, `check:server`).
   2. Try `vp migrate` on a branch; decide on Oxlint and Oxfmt against `deno lint` and `deno fmt`; keep the Astro commands.
   3. Move the front end tests from `Deno.test` and `@std/assert` to Vitest. It is mechanical (the 14 router tests were converted by script in #76): 42 test files and 466 tests, with `@std/assert` imported in 43 files, and about 51 files that use `Deno.*` file calls, which become `node:fs`.
   4. Move the scripts (`build-samples`, `build-docs`, `format-tables`, `format-references`, `build-diagrams`) to Node with type stripping, and `deno bundle` of the analysis worker to Vite or `vp pack`.
   5. Remove `deno.json` and `deno.lock`, and mark ADR-0002 superseded (#61).
4. **Keep the portability rule** (`tsconfig.shared.json`): shared modules must load under Node whichever runner is used.
5. **Effort.** My estimate for steps 3 and 4 together is one to two days of mostly mechanical work; it is a guess, not a measurement.

## References

- Cloudflare. (2026, June 4). *Cloudflare acquires VoidZero to build the future of the AI-native web*. Business Wire. https://secure.businesswire.com/news/home/20260604108073/en/Cloudflare-Acquires-VoidZero-to-Build-the-Future-of-the-AI-Native-Web
- InfoQ. (2026, October). *Vite+ 1.0* [News]. https://www.infoq.com/news/2026/10/cloudflare-viteplus-stable
- VoidZero. (n.d.). *Migrate to Vite+*. Retrieved November 11, 2026, from https://main.viteplus.dev/guide/migrate
- Web Dev Simplified. (2026, October 15). *I will never use Prettier or ESLint again* [Video]. YouTube. https://www.youtube.com/watch?v=J37YeB63LVI
