# TigerLegs

<img src="./public/img/tigerlegs-logo.png" alt="TIGERLegs logo: a tiger head with a blue and green GPS route in its stripes, next to the name" width="240">

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="./public/img/tigerlegs-acronym-anim-dark.svg">
  <img src="./public/img/tigerlegs-acronym-anim.svg" alt="Animation expanding TIGERLEGS into its backronym: Terrain Informed Gpx ExtractoR: LEts Go Swimrun!" width="800">
</picture>

![TigerLegs: a tiger swims across a bay and runs along the coast, following a GPS route](./public/img/tigerlegs-promo.png)

TigerLegs splits a swimrun into its swim and run legs, whether it is a race course or one of your own training sessions. You upload a GPX file, and the tool shows it on an interactive map next to a table with the distance of every swim (in metres) and run (in kilometres).

Two kinds of GPX file go in, and what the tool can use differs:

- **A course from an organiser** often holds only positions and waypoints, without times. Then the speed cannot be derived, and TigerLegs relies on the waypoints (swim start and end) and on the terrain (water from OpenStreetMap).
- **A recording of your own training** has times, so the speed shows where you swam and ran, and the terrain adds evidence. Analysing your own training is as much a use case as analysing a race.

**Install it as an app.** The site can be put on the home screen of a phone and opens in a window of its own: on Android with the *Install app* button in the footer when the browser offers it, on an iPhone or iPad with Share and then *Add to Home Screen*. It adds no tracking and no notifications, and it needs a network for now ([ADR-0021](./docs/adr/0021-installable-app-pwa.md)).

TIGERLegs stands for *Terrain-Informed Gpx Extractor: LEts Go Swimrun!* (TIGE-R + LEGS). The tiger is also a nod to Team Groot Rondje Eilanden (TGRE), since a tiger is an amphibious animal and a good swimmer.

**Requirements:** [Node.js](https://nodejs.org/en/download) 22.23 or newer with npm (version 24 is pinned in `.nvmrc`), for the site, the back end, the tests and the build tasks; PlantUML with Java, only to redraw the diagrams in the guidebook (`npm run diagrams`); and a modern web browser. The maintainers develop on macOS and have not tested other platforms.

## 1. Getting started

1. Install [Node.js](https://nodejs.org/en/download). Node.js can come from your package manager or a version manager that reads `.nvmrc`.
2. Clone the repository and open its folder:

   ```sh
   git clone https://github.com/swimrun/gpx-to-swimrun-segments.git
   cd gpx-to-swimrun-segments
   ```

3. Install the dependencies with npm, then start the development server, which first prepares the Web Worker, the samples, the documentation and the styles:

   ```sh
   npm ci
   npm run dev
   ```

4. Open <http://localhost:8123/tigerlegs/> in your browser.
5. Upload a GPX file, for example one from the `test-data/` folder.

### 1.1 Optional: Vite+

[Vite+](https://main.viteplus.dev/guide/) is the toolchain of the Vite team, which bundles the Oxlint linter and the Oxfmt formatter that this project uses (`npm run lint`, `npm run fmt`). You do not need it to build or test TigerLegs. To try its `vp` command:

- Global command, on macOS or Linux: `curl -fsSL https://main.viteplus.dev/install.sh | bash` (on Windows: `irm https://main.viteplus.dev/install.ps1 | iex`). Read the script before you pipe it into a shell. Check it with `vp toolchain --global`.
- In this project, on a branch, to read the diff before you keep anything: `npx --package=vite-plus vp migrate --no-interactive` (the guide gives a pinned version, for example `vite-plus@1.6.0`). Then `vp install`, `vp check` and `vp test`.
- Why it is not a dependency of this project: `vite-plus` 1.6.0 pins Vitest 5.1.0, and this project has Vitest 5.0.5 with the Storybook test addon, so installing it as a dependency fails with a peer dependency conflict (`ERESOLVE`) today; see `docs/vite-plus.md`.

This serves the frontend only; GPX analysis stays in the browser. The optional Node.js API (`npm run server`, tested with `npm run test:server`) is separate and is not required by the site.

## 2. Build and test

| Command                              | What it does                                                  |
| ------------------------------------ | ------------------------------------------------------------- |
| `npm run build`                      | Build the site into `dist/`                                   |
| `npm run preview`                    | Preview the production build                                  |
| `npm test`                           | Run the unit tests                                            |
| `npm run check`                      | Type-check Astro and React                                    |
| `npm run check:shared`               | Check the shared modules are portable                         |
| `npx playwright install chromium`    | Install the test browser (once)                               |
| `npm run test:site`                  | Test the built site in the browser                            |
| `npm run test:features`              | Run the Gherkin acceptance criteria                           |
| `npm run test:a11y`                  | Test the components for accessibility                         |
| `npm run lint`                       | Lint the code (Oxlint)                                        |
| `npm run fmt`                        | Format the code (Oxfmt)                                       |
| `npm run tables`, `refs`, `headings` | Format the Markdown tables, references and headings of a file |
| `npm run diagrams`                   | Redraw the PlantUML diagrams (needs PlantUML)                 |

The Worker in the build is a browser Web Worker, not an Astro feature: it runs the heavy GPX analysis on a background thread so that the page does not freeze on a large file. Its source is `src/client/analysis-worker.ts`; `npm run build:js` bundles it into `public/analysis-worker.js`, which Astro copies into `dist/`. Files of up to 10,000 trackpoints are analysed on the page itself.

Astro builds the shared layout and the static pages, and React runs the extractor.

GitHub Actions tests and builds the site, then publishes `dist/` to GitHub Pages; nothing runs on a server in production. See [ADR-0008](./docs/adr/0008-astro-static-site-with-react-islands.md) and [ADR-0009](./docs/adr/0009-react-for-interactive-frontend.md).

Working on terrain detection? Run a local Overpass server with Docker instead of the public ones: see [docs/local-overpass.md](./docs/local-overpass.md).

## 3. Back end (optional)

The site works without a back end: GPX analysis and the terrain lookup happen in the browser. The back end is an optional Node.js service ([ADR-0013](./docs/adr/0013-back-end-is-optional.md), [ADR-0014](./docs/adr/0014-back-end-technology.md)); today it is a terrain proxy with a file cache, and premium features come later.
It needs Node.js 22.18 or newer, which runs the TypeScript directly, and no extra packages.

```sh
PORT=8124 npm run server
curl http://localhost:8124/api/v1/health
```

Use another port than 8123, which the Astro development server takes and which is also the back end's default.

| Variable           | Default                                   | Meaning                                                                                       |
| ------------------ | ----------------------------------------- | --------------------------------------------------------------------------------------------- |
| `PORT`             | `8123`                                    | Port to listen on                                                                             |
| `ALLOWED_ORIGINS`  | `http://localhost:8123`                   | Comma-separated origins that may call the API (CORS and an origin check)                      |
| `STATIC_DIR`       | `./public`                                | Folder to serve as static files (development); a path that does not exist serves the API only |
| `CACHE_PATH`       | `./data/terrain_cache`                    | Folder of the file cache for terrain answers                                                  |
| `OVERPASS_API_URL` | `https://overpass-api.de/api/interpreter` | Overpass server; use the local one of [docs/local-overpass.md](./docs/local-overpass.md)      |

Endpoints: `GET /api/v1/health`, `GET /api/v1/terrain/lookup?lat=…&lon=…` and `POST /api/v1/terrain/batch` with `{"coordinates": [{"lat": …, "lon": …}]}` (at most 100).
Tests and checks: `npm run test:server` (Vitest) and `npm run check:server` (compiles with only Node's types).
As a container: `docker build -t tigerlegs-api .` and `docker run -p 8123:8123 tigerlegs-api`.

**CORS.** The site on GitHub Pages and the API have different origins, so a browser only lets the site call the API when the API allows that origin: the back end answers only for the origins in `ALLOWED_ORIGINS` and refuses other origins on the API routes with 403 (`/api/v1/health` needs no origin). When the back end itself serves the front end (`STATIC_DIR`), calls are same-origin and CORS plays no part.

## 4. Roadmap

The roadmap shows what is done and what is planned. Checked items are done.
For the longer horizon — terrain milestones, the Garmin Connect IQ data field and Apple Watch/Coros export — see the [milestone roadmap](./docs/ROADMAP.md) and the [product vision](./docs/PRODUCT_VISION.md).

![Mock-up of the planned Garmin Connect IQ data field: current leg "RUN 4/12", 620 m to the next swim, and the next swim is 1.4 km](./img/garmin-datafield-mock.png)

![Aerial photo of swimrunners swimming along a rocky shore](./img/swimrunners-aerial-swim.png)

- [x] GPX parsing with swim and run segment detection
- [x] Interactive Leaflet map with colour-coded segments
- [x] Segment distance table with totals
- [ ] Highlighting that links the map and the table
- [ ] Toggle for the swim-first column order (default off, so run first)
- [ ] Toggle for a cumulative distance column
- [ ] Toggle between kilometres and metres, and miles and yards
- [ ] Elevation profile per segment
- [ ] Support for GPX conventions beyond Openrunner
- [ ] Garmin Connect IQ data field (see the [constraints](./docs/software-guidebook.md#4-constraints) in the guidebook)
- [ ] Accounts and login (for example Auth0), and saving analysed routes online. This is the first feature that needs a real backend, and it needs its own privacy review, because stored routes reveal home locations. Until then the app stays static, with no backend.

## 5. Learn more

The [software guidebook](./docs/software-guidebook.md) describes what the system does (including use cases and an example course), how it is built, the domain terms and the GPX conventions it relies on. The [architecture decision records](./docs/adr/) explain why the design looks the way it does.

## 6. Contribute

Read [CONTRIBUTING.md](./CONTRIBUTING.md) to get involved and [AGENTS.md](./AGENTS.md) for the working agreements. Documentation lives in the repository and changes in the same commit as the behaviour it describes, so update the README, the guidebook or an ADR when your change affects them.

<img src="./public/img/tigerlegs-logo.png" alt="TIGERLegs logo: a tiger head with a blue and green GPS route in its stripes, next to the name" width="720">
