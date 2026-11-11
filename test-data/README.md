# Test Data

GPX files for testing and demonstration purposes.

## Files

| File                                                 | Race                                                                                                                                                 | Starts with | Segments                                                                                                                                                            | Source                                          |
| ---------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- | ----------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------- |
| `vertical-swimrunman-laffrey-2026.gpx`               | Vertical SwimRunMan Laffrey                                                                                                                          | Swim        | 7 swim + 7 run                                                                                                                                                      | Openrunner                                      |
| `otillo-sandhamn-uto.gpx`                            | ÖTILLÖ World Championship                                                                                                                            | Run         | 24 swim + 26 run                                                                                                                                                    | otillo.com / racedaymap.com                     |
| `swimrun-troll-enez.gpx`                             | SwimRun Troll (Enez, FR)                                                                                                                             | Run         | Long swims                                                                                                                                                          | swimruntroll.com                                |
| `het-rondje-elanden-vinkeveen.gpx`                   | Het Rondje Elanden                                                                                                                                   | Run         | 11 segments, 6.5km total                                                                                                                                            | hetrondjeelanden.nl                             |
| `running-only-afstandmeten.gpx`                      | (no race, just a run)                                                                                                                                | Run         | 0 swim (edge case)                                                                                                                                                  | afstandmeten.nl                                 |
| `rhederlaag-swimrun.gpx`                             | Swimrun Rhederlaag (2025-10-11)                                                                                                                      | n/a         | Not verified yet                                                                                                                                                    | Strava export                                   |
| `Rondje_Eilanden_lintjes_opruimen.gpx`               | Rondje Eilanden: lintjes opruimen (2026-07-19), no longer a sample                                                                                   | n/a         | Not verified yet                                                                                                                                                    | Strava export                                   |
| `Rondje_Eilanden_2025.gpx`                           | Het Rondje Eilanden (2025-07-19), own Strava recording; heart rate, cadence and power stripped; the first swim was 100 to 200 m longer than standard | Swim        | Official: 11 swims (1,500 m) + 11 runs (5,000 m), total 6,500 m (organiser's course map); recorded 6,958 m. Test: `test/client/rondje-eilanden.integration.test.ts` | Strava export                                   |
| `Twiske_Backyard_SwimRun_Experience.gpx`             | Twiske Backyard Ultra SwimRun Experience (2026-06-20)                                                                                                | n/a         | Not verified yet; many laps                                                                                                                                         | Strava export                                   |
| `Ötillö_Rügen_met_Sander_SwimRun_World_Serious_.gpx` | ÖTILLÖ Rügen SwimRun World Series                                                                                                                    | n/a         | Not verified yet                                                                                                                                                    | Strava export                                   |
| `Frankrijk_SwimRun_Coros.gpx`                        | ÖTILLÖ Cannes World Series (2026-10-03)                                                                                                              | Run         | Official: 12 run + 11 swim, run 33.10 km, swim 7.30 km, total 40.40 km (racedaymap.com); recorded 43.7 km. Test: `test/client/cannes.integration.test.ts`           | Coros export from a friend; heart rate stripped |

## Sample tracks on the website

`deno task build:samples` (part of `deno task build`) copies the typical GPX file of
every sample variant from this folder to `public/samples/`, where the extractor page
offers them. The courses, their variants, descriptions and file mapping live in
`src/client/sample-courses.ts`. A variant without a file is listed on the page as
"GPX to be added".

| Course                  | Variant                                           | File here                                            | Track points |
| ----------------------- | ------------------------------------------------- | ---------------------------------------------------- | ------------ |
| Rhederlaag SwimRun      | As recorded, 11 October 2025                      | `rhederlaag-swimrun.gpx`                             | 5769         |
| Rhederlaag SwimRun      | High water, low water, water bird breeding season | to be added                                          | n/a          |
| Het Rondje Eilanden     | Race day                                          | `Rondje_Eilanden_2025.gpx`                           | 4491         |
| Het Rondje Eilanden     | Training                                          | to be added                                          | n/a          |
| Twiske Backyard SwimRun | Standard                                          | `Twiske_Backyard_SwimRun_Experience.gpx`             | 9228         |
| Ötillö Rügen            | Standard                                          | `Ötillö_Rügen_met_Sander_SwimRun_World_Serious_.gpx` | 19771        |
| Ötillö Cannes           | Standard                                          | `Frankrijk_SwimRun_Coros.gpx`                        | 18272        |

`rhederlaag-swimrun.gpx` is also used by the integration tests
(`test/client/rhederlaag.integration.test.ts` and `test/client/water.test.ts`),
so do not rename or replace it without updating them.

## Expected segment distances

### Provisional recording observations

These observations come from the participant who supplied the recordings, not a verified course sheet.

- **Rhederlaag:** the current speed-only result has eight swim/run pairs; approximately twelve are expected (exact count pending). In particular, a displayed 2.7 km run contains two water crossings and should split into five alternating run/swim segments. Paired table rows are not individual segments.
- **Twiske Backyard:** the recording contains three repetitions of the same swimrun lap, with rest until the next hour between laps. Each lap reportedly contains approximately five or six swims and as many runs; the participant will confirm the count. Previously, speed-only analysis labelled each whole mixed lap as a run and the two roughly 26-minute rests as swims.

The Twiske GPX continues recording during the rests: accumulated GPS drift is not evidence of actual swimming. Analysis now marks sustained confinement within 50 m of an anchor for at least ten minutes as an unclassified rest candidate and preserves it between laps. This conservative heuristic is not proof of a rest: exceptionally slow movement within that area can also qualify, and short excursions near a rest may remain classified as movement. Rest distance remains visible when breaks are included; it does not contribute to swim/run totals.

Speed-only classification cannot reliably distinguish a slow run, a swim with GPS drift, and a rest. Terrain remains opt-in, and mapped-water crossings should be tested offline against the existing Rhederlaag fixture rather than tuning the algorithm to an uncertain total count. Missing or incomplete water polygons and the terrain speed gate can still hide crossings. Exact lap counts and transition locations remain open validation work.

Regression tests cover the real Twiske rest interiors, continuous track coverage, GPS jitter, slow moving swims, short pauses, missing timestamps, and preserving same-type laps across rests.

The recorded Rhederlaag water fixture does split the 2.7 km run, but currently produces five swim fragments overlapping that region, not a verified two crossings. This is evidence of refinement, not a correct course reconstruction. The terrain strategy only claims swims: it cannot correct speed-only false swims on land, and its 7 km/h speed gate plus confidence arbitration can leave runs inside a mapped crossing. Fixing rest interiors does not recover Twiske's within-lap swims or eliminate every short movement classification around a rest.

### ÖTILLÖ Sandhamn-Utö

~75km total: 9km swimming, 65km trail running across 24 islands.
Source: https://otillo.com

### SwimRun Troll (Enez)

Long-distance French swimrun with substantial open-water swims.
Source: https://www.swimruntroll.com/

### Het Rondje Eilanden Vinkeveen

6,500 m in total: 1,500 m of swimming (11 swims, A to K) and 5,000 m of running (11 runs).
The race starts with swim A and ends with run 1.
Source: the organiser's course map (Het Rondje Eilanden, n.d.), with the lengths per swim and run that `test/client/rondje-eilanden.integration.test.ts` uses.

### Running-only (edge case)

A GPX with no swim waypoints. The tool should display it as a
single track without segmentation.
Source: https://afstandmeten.nl (draw and export)

## How to add files

1. Download the GPX from the source listed above
2. Rename to match the filename in the table
3. Place in this `test-data/` directory

## Sources for the expected values

The integration tests compare the extractor with official splits.
References follow APA 7, as AGENTS.md requires.

- Het Rondje Eilanden. (n.d.). *Parcours* [Course map with the length of every swim and run]. Retrieved November 10, 2026, from https://www.hetrondjeeilanden.nl/wedstrijd/parcours/
- ÖTILLÖ. (n.d.). *ÖTILLÖ Cannes World Series*. Retrieved November 10, 2026, from https://otilloswimrun.com/races/cannes-france/cannes-world-series/ (full distance: total 40,950 m, run 33,470 m, swim 7,480 m)
- RaceDayMap. (n.d.). *ÖTILLÖ Swimrun Cannes: World Series* [Interactive course map and leg table]. Retrieved November 10, 2026, from https://app.racedaymap.com/otillo-swimrun-cannes/world-series (12 runs and 11 swims, total 40.40 km, run 33.10 km, swim 7.30 km; this is the reference used in the Cannes test)

The two Cannes sources differ by 0.37 km of running and 0.18 km of swimming; the test uses the RaceDayMap figures.

## Timestamps in the samples

The sample files keep their timestamps, because the speed analysis needs them to tell swimming from running and the extractor shows the moving and event time.
Heart rate, cadence and power are stripped from the samples.
The date is kept on purpose: it identifies the edition of an event, courses differ between editions (for example a swim crossing that was dropped after a government restriction), and an edition means something to people.
Normalising the clock to a fixed start time while keeping the date as metadata of the variant is possible later; see the software guidebook, section 6.6.
