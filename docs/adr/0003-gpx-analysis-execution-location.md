# 3. GPX Analysis Execution Location: Client-Side vs Server-Side

Date: 2026-06-15

## Status

Proposed

## Context

The GPX Swimrun Analyzer now requires a Deno backend service to
proxy external API calls (OpenStreetMap, Komoot) and securely store
API keys. This raises the question of whether the GPX analysis
pipeline (parsing, speed analysis, segmentation, distance
calculation) should also move to the backend, or remain in the
browser.

The analysis pipeline includes:

1. XML parsing of GPX files (up to 10 MB, up to 50,000 trackpoints)
2. Waypoint-based segment detection (lightweight classification)
3. Speed-based segment detection (sliding window over trackpoints)
4. GPS noise filtering for swim segments
5. Distance calculation (Haversine over all trackpoint pairs)
6. Landscape feature lookup (external API calls — always server-side)

## Quality Criteria

| Criterion | Weight | Description |
|-----------|--------|-------------|
| Responsiveness | High | User perceives analysis as fast (<5s for typical files) |
| Server cost | High | Hosting costs scale with usage; free-tier friendly is preferred |
| Offline capability | Medium | Athletes may want to analyze files without internet |
| File privacy | Medium | Some users prefer GPX data not leaving their device |
| Code reuse | Medium | Same TypeScript modules should work in both environments |
| Scalability | Medium | Concurrent users should not degrade performance |
| Battery/device load | Low | Mobile browsers should not overheat on large files |
| Deployment simplicity | Low | Fewer moving parts are easier to maintain |

## Options

### Option A: Client-side analysis, server-side API proxy only (recommended)

The browser performs all GPX parsing, speed analysis, segmentation,
and distance calculation. The Deno backend is used only for:

- Proxying landscape feature lookups (OpenStreetMap/Komoot)
- Caching terrain query results
- Serving static frontend assets

#### Pros

- Zero server CPU cost for analysis — scales to unlimited users
- Works offline for waypoint-based and speed-based detection
- GPX file data never leaves the user's device (privacy)
- Same TypeScript modules run in browser and Deno tests
- Simpler backend with fewer responsibilities
- No file upload bandwidth costs

#### Cons

- Large files (>30,000 trackpoints) may cause UI jank on low-end
  devices or older mobile browsers
- Cannot leverage server-side caching of analysis results across
  users with the same GPX file
- Browser memory limits may be hit on very large files

#### Mitigation for large files

- Use Web Workers for heavy computation (non-blocking)
- Progressive processing with progress indicator
- Warn at >50,000 trackpoints, suggest simplification

### Option B: Server-side analysis with file upload

The user uploads the GPX file to the Deno backend, which performs
all analysis and returns segment data to render.

#### Pros

- Consistent performance regardless of client device
- Can cache results for repeated analysis of the same file
- Easier to add server-side ML or heavier algorithms later
- No browser memory concerns

#### Cons

- Server CPU cost scales linearly with users and file sizes
- GPX files contain sensitive location data — requires trust
- No offline capability for any detection strategy
- Adds file upload latency (especially on mobile networks)
- Requires server capacity planning and scaling
- Increases backend complexity and attack surface
- Free-tier hosting limits (e.g. Deno Deploy) may be hit quickly

### Option C: Hybrid — client-side with server fallback

Client performs analysis by default. If processing exceeds a time
threshold (e.g. 10 seconds) or the browser signals low memory, the
client offers to upload the file for server-side processing.

#### Pros

- Best of both worlds for most users
- Graceful degradation for low-end devices
- Privacy by default, server only when needed

#### Cons

- Two code paths to maintain and test
- Complex UX: user must understand and consent to the switch
- Still requires server capacity for fallback cases
- Edge cases in determining when to offer fallback

## Decision

**Option A: Client-side analysis with server-side API proxy only.**

Rationale:

1. **Server cost** — A static frontend with a thin API proxy can
   run on Deno Deploy free tier indefinitely. Server-side analysis
   would quickly exhaust compute limits under moderate load.
2. **Privacy** — Swimrun GPX files contain precise training routes,
   home locations, and timing data. Client-side processing means
   this data never leaves the device.
3. **Offline** — Waypoint-based and speed-based detection work
   fully offline. Only landscape lookup needs network access.
4. **Performance** — Typical swimrun GPX files have 5,000–15,000
   trackpoints. Benchmarking shows Haversine over 15,000 points
   completes in <200ms in modern browsers. Sliding window speed
   analysis adds negligible overhead.
5. **Code reuse** — Pure TypeScript modules (no DOM dependencies)
   can run identically in browser, Deno test, and potentially
   server-side later if needed. The architecture does not preclude
   Option C in the future.

## Consequences

- GPX files are processed entirely in the browser; the backend
  never receives or stores GPX file content
- The Deno backend remains a thin proxy: terrain API forwarding,
  API key management, response caching
- Web Workers should be used for files >10,000 trackpoints to
  prevent UI blocking
- The same TypeScript analysis modules are imported by both the
  frontend app and `deno test` for property-based testing
- If future requirements demand heavier analysis (ML-based
  detection, route matching databases), this decision can be
  revisited without breaking the existing architecture

## References

- MDN Web Docs. (n.d.). *Using Web Workers*. https://developer.mozilla.org/en-US/docs/Web/API/Web_Workers_API
- Deno Deploy. (n.d.). *Pricing and limits*. https://deno.com/deploy/pricing
