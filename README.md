# TigerLegs

<img src="./public/img/tigerlegs-logo.png" alt="TIGERLegs logo: a tiger head with a blue and green GPS route in its stripes, next to the name" width="240">

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="./public/img/tigerlegs-acronym-anim-dark.svg">
  <img src="./public/img/tigerlegs-acronym-anim.svg" alt="Animation expanding TIGERLEGS into its backronym: Terrain Informed Gpx ExtractoR: LEts Go Swimrun!" width="800">
</picture>

![TigerLegs: a tiger swims across a bay and runs along the coast, following a GPS route](./public/img/tigerlegs-promo.png)

TigerLegs splits a swimrun course into its swim and run legs. You upload a GPX file, and the tool shows the course on an interactive map next to a table with the distance of every swim (in metres) and run (in kilometres).

TIGERLegs stands for *Terrain-Informed Gpx Extractor: LEts Go Swimrun!* (TIGE-R + LEGS). The tiger is also a nod to Team Groot Rondje Eilanden (TGRE), since a tiger is an amphibious animal and a good swimmer.

**Requirements:** [Deno](https://deno.com/) 2.x and a modern web browser. The maintainers develop on macOS and have not tested other platforms.

## Getting started

1. Install Deno by following the [installation guide](https://docs.deno.com/runtime/getting_started/installation/).
2. Clone the repository and open its folder:

   ```sh
   git clone https://github.com/swimrun/gpx-to-swimrun-segments.git
   cd gpx-to-swimrun-segments
   ```

3. Install site dependencies (Node.js 22.23.4 or newer is required), then start the Astro development server:

   ```sh
   npm ci
   deno task dev
   ```

4. Open <http://localhost:8123/tigerlegs/> in your browser.
5. Upload a GPX file, for example one from the `test-data/` folder.

This serves the frontend only; GPX analysis stays in the browser. The optional Deno API is separate and is not required by the site.

## Build and test

| Task | Command |
| --- | --- |
| Build the Astro static site into `dist/`, including the Worker, samples and all ADRs | `deno task build` |
| Check Astro and React types | `npm run check` |
| Run analysis and documentation unit tests | `deno task test` |
| Install the browser for site tests (once) | `npx playwright install chromium` |
| Test built static routes and React interactions | `npm run test:site` |
| Preview the production build | `npm run preview` |
| Lint the code | `deno task lint` |
| Format the code | `deno task fmt` |

Astro supplies the shared layout and static HTML pages; React supplies the interactive extractor. Pure TypeScript analysis modules remain tested with Deno. npm owns `node_modules/` and `package-lock.json`; Deno uses that installed dependency tree (`nodeModulesDir: manual`), so run `npm ci` before Deno commands on a fresh checkout.

GitHub Actions tests and builds the site, then publishes `dist/` to GitHub Pages. No Astro or Node process runs in production. Existing `about.html` and `guidebook.html` URLs and chapter anchors are preserved; chapter 13 links to each generated `adr/*.html` page. See [ADR-0008](./docs/adr/0008-astro-static-site-with-react-islands.md) and [ADR-0009](./docs/adr/0009-react-for-interactive-frontend.md).

## Roadmap

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

## Learn more

The [software guidebook](./docs/software-guidebook.md) describes what the system does (including use cases and an example course), how it is built, the domain terms and the GPX conventions it relies on. The [architecture decision records](./docs/adr/) explain why the design looks the way it does.

## Contribute

Read [CONTRIBUTING.md](./CONTRIBUTING.md) to get involved and [AGENT.md](./AGENT.md) for the working agreements. Documentation lives in the repository and changes in the same commit as the behaviour it describes, so update the README, the guidebook or an ADR when your change affects them.

<img src="./public/img/tigerlegs-logo.png" alt="TIGERLegs logo: a tiger head with a blue and green GPS route in its stripes, next to the name" width="720">
