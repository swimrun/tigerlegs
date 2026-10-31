# Test Data

GPX files for testing and demonstration purposes.

## Files

| File | Race | Starts with | Segments | Source |
|------|------|-------------|----------|--------|
| `vertical-swimrunman-laffrey-2026.gpx` | Vertical SwimRunMan Laffrey | Swim | 7 swim + 7 run | Openrunner |
| `otillo-sandhamn-uto.gpx` | ÖTILLÖ World Championship | Run | 24 swim + 26 run | otillo.com / racedaymap.com |
| `swimrun-troll-enez.gpx` | SwimRun Troll (Enez, FR) | Run | Long swims | swimruntroll.com |
| `het-rondje-elanden-vinkeveen.gpx` | Het Rondje Elanden | Run | 11 segments, 6.5km total | hetrondjeelanden.nl |
| `running-only-afstandmeten.gpx` | (no race, just a run) | Run | 0 swim (edge case) | afstandmeten.nl |
| `rhederlaag-swimrun.gpx` | Swimrun Rhederlaag (2025-10-11) | n/a | Not verified yet | Strava export |
| `Rondje_Eilanden_lintjes_opruimen.gpx` | Rondje Eilanden: lintjes opruimen (2026-07-19) | n/a | Not verified yet | Strava export |
| `Twiske_Backyard_SwimRun_Experience.gpx` | Twiske Backyard Ultra SwimRun Experience (2026-06-20) | n/a | Not verified yet; many laps | Strava export |
| `Ötillö_Rügen_met_Sander_SwimRun_World_Serious_.gpx` | ÖTILLÖ Rügen SwimRun World Series | n/a | Not verified yet | Strava export |

## Sample tracks on the website

`deno task build:samples` (part of `deno task build`) copies four files from
this folder to `public/samples/`, where the extractor page offers them as
sample links. The mapping lives in `src/build-samples.ts`.

| File here | Sample name on the site | Track points |
|-----------|-------------------------|--------------|
| `rhederlaag-swimrun.gpx` | Rhederlaag SwimRun | 5769 |
| `Rondje_Eilanden_lintjes_opruimen.gpx` | Rondje Eilanden | 2892 |
| `Twiske_Backyard_SwimRun_Experience.gpx` | Twiske Backyard SwimRun | 9228 |
| `Ötillö_Rügen_met_Sander_SwimRun_World_Serious_.gpx` | Ötillö Rügen | 19771 |

`rhederlaag-swimrun.gpx` is also used by the integration tests
(`test/client/rhederlaag.integration.test.ts` and `test/client/water.test.ts`),
so do not rename or replace it without updating them.

## Expected segment distances

### ÖTILLÖ Sandhamn-Utö

~75km total: 9km swimming, 65km trail running across 24 islands.
Source: https://otillo.com

### SwimRun Troll (Enez)

Long-distance French swimrun with substantial open-water swims.
Source: https://www.swimruntroll.com/

### Het Rondje Elanden Vinkeveen

~6.5km total: 1500m swimming, 5km running, 11 segments.
Source: https://hetrondjeelanden.nl

### Running-only (edge case)

A GPX with no swim waypoints. The tool should display it as a
single track without segmentation.
Source: https://afstandmeten.nl (draw and export)

## How to add files

1. Download the GPX from the source listed above
2. Rename to match the filename in the table
3. Place in this `test-data/` directory
