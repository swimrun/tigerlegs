# Feature Specification: Course playback, idealized courses with variants and an admin view for naming legs

**Feature Branch**: `004-course-playback-and-admin`
**Created**: 2026-11-12
**Status**: Draft
**Input**: The owner's request of 12 November 2026 (playback of a GPX file, an admin view to name segments, an idealized track with variants); issue #107 (named legs of official courses), issue #80 (variants of a course and the TODOs for missing GPX files), issue #94 (speed chart, pins on the map), issue #109 (edit the track, outlier points), issue #98 (the first swim of the race day recording found as a run), the Course aggregate in the software guidebook (section 6.6), [ADR-0013](../../docs/adr/0013-back-end-is-optional.md) (the back end is optional) and issue #90 (research into a login service). Tracked in issue #108.

## User Scenarios & Testing *(mandatory)*

### Primary User Stories

As a swimrunner, I want to replay my recording on the course, see in which named leg I am at every moment, and see how my recording relates to the course and its variants, so that I understand how my race or training went.

As the owner of an official course, I want to name the legs of my course and describe its variants (another start or finish, cut-offs, parts that are left out), so that every recording of that course is read against the right legs, with the names that my athletes know.

The athlete stays in charge of their own file: a recording is analysed in the browser and is not sent anywhere (guidebook, section 5). A course is different: it is the idealized line of a track with no athlete, no time and no speed, and it can be shared.

### Acceptance Scenarios

#### Playback

1. **Given** an analysed recording with timestamps, **When** the athlete presses *Play*, **Then** a marker moves along the track on the map at real-time speed, a scrubber shows the position in time, and the current leg (or segment number), time, distance and speed are shown.

2. **Given** a playing recording, **When** the athlete chooses a faster speed (for example 10 times or 60 times), **Then** the marker moves faster and the readouts follow.

3. **Given** a recording without timestamps, **When** the athlete presses *Play*, **Then** the recording plays by distance at a speed the athlete chooses, and the time and speed readouts say that the file has no timestamps.

4. **Given** the scrubber, **When** the athlete drags it or uses the arrow keys, **Then** the marker jumps to that position, and the table row, the map line and the speed chart of the current leg are highlighted.

5. **Given** the marker enters a new leg, **When** this happens during playback, **Then** the name of the leg is announced to screen readers once ("Swim B"), not once per frame.

6. **Given** a person who prefers reduced motion, **When** the page opens, **Then** playback does not start by itself and does not animate smoothly; the athlete can still step through the track with the keys.

#### The idealized course and its legs

7. **Given** an official course with a main variant, **When** the owner opens it in the admin view, **Then** the map shows the idealized line, with the legs on it as coloured stretches (swim blue, run green) in order, and a list of the legs with their names, kinds and official distances.

8. **Given** the idealized line, **When** the owner selects a stretch and gives it a name (for example "Swim A"), **Then** it is a named leg of the course with a kind (swim or run) and a distance measured on the line.

9. **Given** a recording of the course, **When** the owner chooses *Start from this recording*, **Then** the segments found in the recording become the first version of the legs, which the owner can then rename, move the boundary of, merge or split.

10. **Given** the legs of a course, **When** two legs overlap, leave a gap, are not in order, or have the same name, **Then** saving is refused and the message names the legs involved.

11. **Given** the sum of the leg distances, **When** it differs from the length of the line by more than the tolerance, **Then** the admin view shows a warning with both numbers.

#### Variants

12. **Given** a course, **When** the owner creates a variant, **Then** it starts as a copy of the main variant and the owner can change where it starts and where it finishes (cut-offs) by choosing points on the line.

13. **Given** a variant, **When** the owner marks a part of the line as left out (for example the part from island 3 to 5 in *Lintjes opruimen*), **Then** the variant lists only the legs it covers, a leg that is cut in two by a cut-off keeps its name with the part that remains, and the distance of the variant is recalculated.

14. **Given** a variant with a validity (for example only the edition of 2026, or only the months April to June), **When** an athlete opens the course, **Then** the variant shows its validity and the main variant is marked.

15. **Given** several variants of one course, **When** the athlete picks one, **Then** the map, the legs and the table show that variant, and the other variants stay one choice away.

#### Matching a recording to a course

16. **Given** a recording and a course, **When** they are matched, **Then** each leg of the variant gets the segment (or segments) found in the recording for it, and the table shows the leg names next to the numbers.

17. **Given** a recording that misses a part of the course, **When** it is matched, **Then** the missing legs are shown as missing, and the page suggests the variant that fits (for example *Lintjes opruimen*).

18. **Given** a segment that does not fit any leg, or a leg whose found distance is outside the tolerance, **When** the recording is matched, **Then** it is shown as a deviation, so that the owner or the athlete can see where the analysis and the course disagree.

#### Cleaning and cutting the track (issue #109)

23. **Given** a recording, **When** it is analysed, **Then** every trackpoint that implies a speed above the plausible limit (20 km/h by default) is flagged on the map and in a list, and playback and the analysis do not use it until the owner or the athlete keeps it.

24. **Given** a flagged or a selected point, **When** the owner removes it, **Then** the removal is stored as a track edit next to the recording, the totals update and the marker no longer jumps or glides at a speed that was never reached.

25. **Given** a transition point between a swim and a run, **When** the owner drags it along the track, **Then** the two legs change and the edit is stored; the speed limit between swimming and running (5 km/h by default, 3 to 10 km/h) is a separate setting.

26. **Given** a mountain course or a fast athlete, **When** the owner changes the plausible speed limit of the course, **Then** the flags are recalculated for every recording on it.

#### Saving, versions and who may edit

19. **Given** a course that is published, **When** the owner edits it, **Then** the edit is a draft; publishing creates a new version, and the version an athlete opened earlier stays readable.

20. **Given** two owners who edit the same course, **When** both save, **Then** the first save wins and the second is told that the course changed, as in the repositories of the stored model (guidebook, section 7.6).

21. **Given** no accounts yet (the first step), **When** the owner is done, **Then** they can export the course as a file (a course pack) and import it again, and the course pack in the repository is reviewed in a pull request.

22. **Given** a reader who is not an owner, **When** they open a course, **Then** they can look at it and play recordings on it, but they have no edit controls.

### Edge Cases

- A course with laps (the Twiske backyard course): a leg can repeat per lap; the matching accepts a number of laps and names the legs of lap 3 "Swim A, lap 3".
- An out-and-back course: the same stretch of the line is used in two directions; legs have a direction.
- A start and a finish at the same place (a loop): the matching must not treat the finish as the start.
- GPS drift at the start (the athlete stands still and the position wanders): the matching starts at the first point that follows the line, and not at the first point of the file.
- A recording that is shorter than the course (stopped early): the legs after the last one reached are shown as not reached, not as missing.
- A recording with GPS jumps (see issue #98): a jump is cleaned before it is matched and is never a leg of its own.
- A recording in the other direction of the course: the matching says so and does not match.
- Two variants whose legs are the same but whose distances differ (the first swim of 400 m on race day, a run on a training day): they stay separate variants with their own legs.
- A course with a main variant that has no GPX file yet (the TODOs of issue #80): the admin view lists it as "GPX to be added" and does not offer legs for it.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The extractor MUST offer playback of the analysed recording: play, pause, a speed choice, a scrubber, and stepping by segment with the keyboard.
- **FR-002**: Playback MUST show a marker on the map and highlight the current segment in the table, on the map and on the speed chart (issue #94) at the same time.
- **FR-003**: Playback of a recording without timestamps MUST be by distance, and MUST say that time and speed are not known.
- **FR-004**: The admin view MUST show the idealized line of a course, its legs and its variants, and let the owner name, split, merge and re-cut legs.
- **FR-005**: A leg MUST have a name that is not empty and unique within its variant, a kind (swim or run), a start and an end measured as the distance along the line, and an official distance.
- **FR-006**: The legs of a variant MUST be ordered, contiguous and cover the included part of the line (the invariant of the Course aggregate, guidebook section 6.6); saving MUST be refused when they do not.
- **FR-007**: A variant MUST be able to start and finish at another point of the line, to leave out one or more stretches, and to have a validity (editions or months); a course MUST have exactly one main variant.
- **FR-008**: The matching of a recording to a variant MUST give, per leg, the segments found in the recording for it, and MUST report legs that are missing, segments that fit no leg, and distances outside the tolerance.
- **FR-009**: The matching MUST be monotonic: the legs are met in the order of the course, and a recording cannot visit a leg twice unless the course has laps.
- **FR-010**: A published course MUST be versioned; an old version MUST stay readable, and a save on a changed course MUST be refused (first commit wins).
- **FR-011**: Names and legs MUST be exportable and importable as a course pack (a text file that holds the course, its variants, its legs and its line, and no athlete data), without a back end.
- **FR-012**: The leg names MUST show next to the numbers in the segment table and on the map, in the table that is copied for a paddle or wristband (ADR-0007).
- **FR-013**: The admin view MUST be limited to owners when accounts exist (issue #90); until then, editing is a local draft that is exported as a course pack.

### Quality Attributes

Qualities are written as quality attribute scenarios, each with a measure that a test can check (guidebook, section 5). A quality that the person using the app notices, such as smooth playback, is also a scenario with a measure, and is part of the features above.

| Quality         | Source                                       | Stimulus                                   | Environment                     | Artifact                    | Response                                                                         | Response measure                                                                                                  |
| --------------- | -------------------------------------------- | ------------------------------------------ | ------------------------------- | --------------------------- | -------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| Privacy         | Swimrunner                                   | Loads a recording and plays it on a course | Normal use, no account          | Browser app                 | Analysis, matching and playback run in the browser                               | No request carries a trackpoint; a course pack holds no athlete data (guidebook, section 5)                       |
| Portability     | Developer                                    | Runs the matching on a recording           | Node without a build step       | Shared domain modules       | The matching and the leg rules load and give the same result                     | `check:shared` and the portability test pass; the same output as in the browser                                   |
| Correctness     | Test suite                                   | Matches the Rondje Eilanden recordings     | Official legs as the oracle     | Matching                    | Every leg gets its segment, deviations are reported                              | 11 swims and 11 runs found for race day; the missing legs of *Lintjes opruimen* are named                         |
| Smooth playback | Swimrunner                                   | Plays a recording of 20,000 points         | Laptop, current Chrome          | Playback                    | The marker and the readouts keep up                                              | At least 30 frames per second; no task on the main thread longer than 50 ms                                       |
| Responsiveness  | Swimrunner                                   | Matches a recording to a variant           | File above the worker threshold | Matching in the Web Worker  | The page stays usable while it runs                                              | The result within 5 seconds for 20,000 points; the page answers input within 100 ms                               |
| Determinism     | Test suite                                   | Matches the same recording twice           | Any                             | Matching                    | The same result                                                                  | Identical output, byte for byte                                                                                   |
| Accessibility   | Swimrunner using a keyboard or screen reader | Uses playback and the admin view           | Any browser                     | Playback, admin view        | Every control can be reached and read; leg changes are announced politely        | Every control has a text label; a leg change is announced once; reduced motion stops animation (axe stories pass) |
| Localisation    | Swimrunner                                   | Opens the page in Dutch, French or German  | Any                             | Texts of playback and admin | Texts show in that language; leg names are data and stay as the owner wrote them | No inline text (strings test); key parity of the four files                                                       |

### Key Entities

- **Course** (aggregate root, exists in the model): a name, a visibility and its variants.
- **CourseLine** (value object, exists): the idealized positions of the track, with no time.
- **CourseVariant** (entity, exists): a name, a description, a canonical flag, a validity, and now a *range* (where it starts and where it finishes along the line) and *left-out stretches*.
- **LegDefinition** (value object, extends `Leg`): a name, a kind, a start and an end along the line, and an official distance; legs belong to a variant.
- **LeftOutStretch** (value object): a start and an end along the line that a variant does not cover.
- **Alignment** (value object, computed, not stored): for a recording and a variant, which trackpoints belong to which leg, with the coverage and the deviations.
- **PlaybackState** (UI state, not stored): the position (an index or a distance), the speed and whether it plays.
- **CoursePack** (a file): the export of a course with its line, variants and legs, with a version and a checksum.

## The shape of the application, in steps

Each step can be built and used without the next one.

1. **Browser only: playback and a read-only course.** Playback in the extractor (FR-001 to FR-003), and the leg names of the sample courses from data in the repository (the sample catalogue, issue #107). The oracle of Het Rondje Eilanden moves from the test into the data. No back end, no login.
2. **Browser only: the admin view as a local editor.** The owner draws legs and variants on the idealized line, matches a recording and exports a course pack; the pack goes into the repository through a pull request (FR-004 to FR-009, FR-011, FR-013). The matching is built here, with the official legs as the oracle.
3. **With the back end: stored courses, versions and owners.** Courses are stored by the data layer ([ADR-0016](../../docs/adr/0016-data-access-layer.md)), published as versions, and edited by owners who log in (issue #90, [ADR-0013](../../docs/adr/0013-back-end-is-optional.md): the front end keeps working without the back end).
4. **Sharing.** Athletes open a course by a link; the course owner sees which variants are used; recordings stay private (guidebook, section 6.6, "Recording" is personal data).

## Open Questions

1. How is a recording matched to a line: by projecting each trackpoint onto the line with a monotonic constraint, or by dynamic time warping, which also copes with a missed stretch and with laps? A small experiment on the Rondje Eilanden recordings (race day and *Lintjes opruimen*) with the official legs as the oracle would decide.
2. Is a variant its own GPX line or a cut of the main line? A variant of another start and finish is a cut; a variant of another route (high water against low water on Rhederlaag) is another line.
3. Who is the owner of a course, and how is that shown? An "official" mark on the course, a verified account, or an invitation by the maintainers? (Related: issue #90.)
4. What file format for a course pack: GeoJSON with a properties block, or the GPX of the idealized line with the legs as waypoints?
5. Is the official split of a course public data (the organiser's course map), and may TigerLegs publish it? For Het Rondje Eilanden the source is the organiser's page (test-data/README.md).
6. Should a leg name be one text or a short code and a text (for example "A" and "Swim from the harbour")? Athletes write the short names on a paddle.
7. Playback needs timestamps for real time; should the speed from the displacement of issue #98 be shown in playback, or the recorded speed from the file?

## Review & Acceptance Checklist

- [x] User scenarios use the Given/When/Then convention and are written for the people who use the app: the swimrunner and the course owner
- [x] Requirements are testable and unambiguous, apart from the open questions above
- [x] The entities extend the Course aggregate of the guidebook (section 6.6) and do not contradict it
- [x] Each step of the application can be used without the next one
- [ ] Open questions resolved
- [ ] Reviewed by the product owner

## Execution Status

- [x] User scenarios defined
- [x] Requirements generated (FR-001…FR-013 and eight quality attribute scenarios)
- [x] Entities identified
- [ ] Plan (technical design, data model, contracts) not started
- [ ] Tasks not started
