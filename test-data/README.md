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
