# Research import: ChatGPT "Hilly Track Pacer" proposal

**Source**: ChatGPT conversation of 12 July 2026 (imported verbatim on
1 November 2026, including its errors — see the review below).
**Status**: raw idea, imported for the record; not yet a basis for
implementation.
**Related**: [spec.md](./spec.md) (Garmin Connect IQ swimrun data field),
[ADR-0005](../../docs/adr/0005-rest-json-api-for-multi-client-support.md).

## First review (TigerLegs maintainers + Copilot, 1 Nov 2026)

### Does it match the TigerLegs idea?

Partly — it is a **different feature**. This proposal is a
*grade-adjusted pace coach* for hilly running: given a route with
elevation and a flat-speed goal pace, it computes a target pace per
segment and alerts on deviation. The TigerLegs M4 spec is a *swimrun leg
data field*: current leg, remaining distance, next leg. They share the
platform (Connect IQ, Monkey C), the "pre-loaded course on the watch"
concept and the map-matching problem, but not the purpose.

That said, the idea is genuinely relevant to TigerLegs: a race like
Vertical SwimRunMan Laffrey 2026 (course in `test-data/`) is exactly
where grade-adjusted pacing matters. Worth keeping as a candidate
**M4+ extension** (a second data field or an extra display state), not
as a replacement for the leg display. Two further differences from our
spec:

- It proposes a **watch-app**; our spec deliberately chooses a
  **data field** (NFR-001) so athletes keep native activity recording.
- It adds pacing alerts (vibration), which our spec does not cover.

### Quality of the code

Treat the code as **pseudocode, not Monkey C** — it sketches the right
shape but would not compile. Concrete problems spotted:

1. `using Toybox.GPS` — no such module. Positioning lives in
   `Toybox.Position` (`enableLocationEvents`), and in a data field you
   get position via `Activity.Info` in `compute()`.
2. `Activity.getPace()` — does not exist. `Activity.getActivityInfo()`
   exposes `currentSpeed` in m/s; pace must be derived.
3. `class ... extends Ui.Application` — applications extend
   `Toybox.Application.AppBase`, not a WatchUi class, and `onUpdate(dc)`
   belongs on a `WatchUi.View` / `DataField`, not on the application.
4. `foreach (var segment in ...)` — Monkey C has no `foreach`.
5. `{ segments: [ { altitudeGain: 10, ... } ] }` — JavaScript object
   syntax; Monkey C dictionary literals use `=>` keys.
6. `currentPace.format("%d:%02d")` — `format` takes one specifier;
   min:sec needs manual splitting.
7. The manifest is the right idea but not the real schema (Connect IQ
   manifests use the `iq:` XML namespace); the `Background` permission
   is not needed for this concept.
8. `isPositionInSegment()` returns `true` ("simplify for demo") — the
   actually hard problem, matching a GPS fix to a route segment, is
   stubbed out. Our spec treats this as the core of FR-002/FR-004.
9. The pace formula `flatPace + altitudeChange * 10` is an acknowledged
   placeholder; real grade-adjusted pace is non-linear in gradient, so
   "insert your formula" is doing a lot of work here.

### What it gets right

- The decomposition (app lifecycle / data processing / pace calculation)
  is sensible and maps onto how we would structure a data field.
- It correctly flags the two real constraints: **memory limits** for
  large tracks and **non-jittery alerts** — both echoed in our spec
  (NFR-003, FR-004 hysteresis).
- Develop-and-test advice (Connect IQ SDK simulator with simulated GPS
  tracks) is accurate and is how we plan to test M4.

### Verdict

Keep as inspiration for a pacing extension after M4; do not build on
the code. The M4 spec remains the implementation basis.

---

## Verbatim import

> I can help you create a **Connect IQ app in Monkey C** for Garmin
> devices tailored to your described use case. Below is an outline of
> the app and how to implement it.
>
> ### App Concept
>
> 1. **User Inputs**:
>    - A pre-defined GPS track with elevation data.
>    - Goal flat-speed pace (e.g., 5:00 min/km).
>    - Altitude adjustment formulas (you've mentioned you already have these).
> 2. **App Functionality**:
>    - Load the GPS track and elevation profile.
>    - Calculate the adjusted pace for each segment (kilometer or smaller)
>      based on elevation change and your formula.
>    - Provide real-time feedback during the run:
>      - Current pace.
>      - Target pace for the current segment.
>      - Distance to the next segment or checkpoint.
>      - Alerts for going too fast or slow.
> 3. **Outputs**:
>    - Visual indicators for current pace vs. goal pace.
>    - Time predictions for the entire course.
> 4. **Challenges to Handle**:
>    - Efficient memory use for large GPS tracks (Garmin devices are
>      resource-limited).
>    - Smooth pacing alerts.
>
> ### Code Outline
>
> Here's a basic **Monkey C** app structure for a Garmin Connect IQ device:
>
> #### 1. Manifest File
>
> The manifest defines app metadata and permissions.
>
> ```xml
> <application>
>     <id>com.example.hillytrackpace</id>
>     <name>Hilly Track Pacer</name>
>     <type>watch-app</type>
>     <permissions>
>         <permission>Position</permission>
>         <permission>Background</permission>
>     </permissions>
>     <products>
>         <product id="fr945" />
>         <product id="fenix6x" />
>         <product id="venu" />
>     </products>
> </application>
> ```
>
> #### 2. App Structure
>
> The app logic will be implemented in these key files:
>
> - `App.mc`: Handles app lifecycle and screen rendering.
> - `DataProcessor.mc`: Processes GPS and altitude data and calculates
>   pace adjustments.
> - `PaceCalculator.mc`: Implements your formulas for adjusted pace.
>
> #### Basic Code Implementation
>
> ##### `App.mc`
>
> ```javascript
> using Toybox.WatchUi as Ui;
> using Toybox.Activity;
> using Toybox.System;
> using Toybox.GPS;
>
> class HillyTrackPacerApp extends Ui.Application {
>     var paceCalculator;
>     var currentPace;
>     var targetPace;
>     var distanceToNextSegment;
>
>     function initialize() {
>         Ui.Application.initialize();
>         paceCalculator = new PaceCalculator();
>     }
>
>     function onStart() {
>         System.println("Starting Hilly Track Pacer");
>         GPS.start();
>     }
>
>     function onStop() {
>         GPS.stop();
>     }
>
>     function onUpdate(dc) {
>         var position = GPS.getPosition();
>         if (position != null) {
>             currentPace = Activity.getPace();
>             targetPace = paceCalculator.calculateTargetPace(position);
>             distanceToNextSegment = paceCalculator.getDistanceToNextSegment(position);
>
>             // Render Data
>             dc.drawText(10, 10, Graphics.FONT_MEDIUM, "Pace: " + currentPace.format("%d:%02d"));
>             dc.drawText(10, 40, Graphics.FONT_MEDIUM, "Target: " + targetPace.format("%d:%02d"));
>             dc.drawText(10, 70, Graphics.FONT_MEDIUM, "Dist: " + distanceToNextSegment + "m");
>         }
>     }
> }
> ```
>
> ##### `PaceCalculator.mc`
>
> ```javascript
> class PaceCalculator {
>     var trackData;  // GPS track and altitude data
>     var flatPace;
>
>     function initialize() {
>         // Load track data (pre-defined GPS route with elevation profile)
>         trackData = this.loadTrackData();
>         flatPace = 5 * 60;  // Flat pace in seconds (5:00 min/km)
>     }
>
>     function calculateTargetPace(position) {
>         var segment = this.getCurrentSegment(position);
>         if (segment == null) { return flatPace; }
>
>         // Get altitude gain/loss
>         var altitudeChange = segment.altitudeGain - segment.altitudeLoss;
>
>         // Apply your custom formula for pace adjustment
>         var adjustedPace = flatPace + (altitudeChange * 10);  // Replace with your formula
>         return adjustedPace;
>     }
>
>     function getCurrentSegment(position) {
>         // Find the current segment based on GPS position
>         foreach (var segment in trackData.segments) {
>             if (this.isPositionInSegment(position, segment)) {
>                 return segment;
>             }
>         }
>         return null;
>     }
>
>     function getDistanceToNextSegment(position) {
>         // Calculate the distance to the next checkpoint or segment
>         var currentSegment = this.getCurrentSegment(position);
>         if (currentSegment == null) { return 0; }
>         return currentSegment.distanceToEnd;
>     }
>
>     function loadTrackData() {
>         // Simulate loading GPS track data
>         return {
>             segments: [
>                 { altitudeGain: 10, altitudeLoss: 5, distanceToEnd: 500 },
>                 { altitudeGain: 20, altitudeLoss: 0, distanceToEnd: 1000 },
>             ]
>         };
>     }
>
>     function isPositionInSegment(position, segment) {
>         // Check if the GPS position is within the segment boundaries
>         return true;  // Simplify for demo
>     }
> }
> ```
>
> #### 3. Testing
>
> Use the **Garmin Simulator** included with the
> [Connect IQ SDK](https://developer.garmin.com/connect-iq/sdk/). You can
> simulate GPS tracks and test your app with sample data.
>
> ### Custom Adjustments
>
> - **Grade-Adjusted Pace**: Replace the placeholder formula
>   (`altitudeChange * 10`) with your real formula.
> - **Visual Enhancements**: Add a progress bar or color indicators
>   (green for on-pace, red for off-pace).
> - **Alerts**: Add vibration or sound alerts when pace deviates
>   significantly from the target.
>
> ### Next Steps
>
> 1. Install the Garmin Connect IQ SDK and try the sample apps.
> 2. Replace placeholders with your specific formulas.
> 3. Test with a real GPS track to refine segment calculations.
>
> Let me know if you'd like help tweaking any part of this! 🚀
