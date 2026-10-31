# Implementation Plan: GPX Swimrun Analyzer

## Overview

Implement a client-server swimrun GPX analysis tool using Deno with TypeScript. The frontend runs GPX parsing, speed analysis, segmentation, GPS noise filtering, and distance calculation in the browser (vanilla TypeScript + Leaflet). The backend is a thin Deno HTTP server proxying OpenStreetMap Overpass API calls with caching. Detection strategies (waypoint, speed, landscape) are combined using confidence scoring.

## Tasks

- [x] 1. Set up project structure, shared types, and testing infrastructure
  - [x] 1.1 Create directory structure and shared types module
    - Create `src/shared/types.ts` with all interfaces and type definitions (Coordinate, Waypoint, Trackpoint, Track, GPXData, Segment, StrategyResult, TerrainResult, FilterResult, DisplaySegment, etc.)
    - Create `src/client/` and `src/server/` directories
    - Create `test/generators.ts` with fast-check custom generators (arbitraryCoordinate, arbitraryWaypoint, arbitraryTrackpoint, arbitraryTrack, arbitraryGPXString, etc.)
    - Add fast-check dependency to `deno.json` imports
    - _Requirements: All (foundational)_

  - [x] 1.2 Implement distance calculator module
    - Create `src/shared/distance-calculator.ts` with `haversineDistance`, `calculateTrackDistance`, `findNearestTrackpoint`, `straightLineDistance`, and `EARTH_RADIUS_KM` constant
    - Use Haversine formula with mean Earth radius of 6,371 km
    - _Requirements: 3.1, 3.2, 3.3, 3.4_

  - [x] 1.3 Write property tests for distance calculator
    - **Property 7: Haversine distance satisfies metric space axioms**
    - **Property 8: Distance accumulation is additive over subsequences**
    - **Property 9: Nearest trackpoint search returns closest point within radius**
    - Create `test/shared/distance-calculator.test.ts`
    - **Validates: Requirements 3.1, 3.2, 3.3, 3.4**

- [x] 2. Implement GPX parsing and file validation
  - [x] 2.1 Implement file upload validation
    - Create `src/client/file-upload.ts` with `validateFile`, `readFileAsText`, and `MAX_FILE_SIZE_BYTES` (10 MB)
    - Validate `.gpx` extension (case-insensitive) and file size ≤ 10,485,760 bytes
    - _Requirements: 1.1, 1.3, 1.6_

  - [x] 2.2 Write property test for file validation
    - **Property 1: File validation accepts only .gpx files within size limit**
    - Create `test/client/file-validation.test.ts`
    - **Validates: Requirements 1.1, 1.3, 1.6**

  - [x] 2.3 Implement GPX parser
    - Create `src/client/gpx-parser.ts` with `parseGPX`, `parseWaypoints`, `parseTracks`, `parseCoordinate`
    - Use `DOMParser` for XML parsing, return `Result<GPXData>`
    - Preserve coordinates to 6 decimal places, elevation to integer, timestamps to 1-second ISO 8601
    - Handle invalid XML gracefully (never throw, return error Result)
    - _Requirements: 1.2, 1.4, 1.5, 7.1, 7.2, 7.3_

  - [x] 2.4 Write property tests for GPX parser
    - **Property 2: GPX parse round-trip preserves coordinate and temporal data**
    - **Property 3: Invalid XML produces error result**
    - Create `test/client/gpx-parser.test.ts`
    - **Validates: Requirements 1.2, 1.4, 7.1, 7.2, 7.3**

- [ ] 3. Implement waypoint-based segment detection (Strategy 1)
  - [x] 3.1 Implement waypoint classifier
    - Create `src/client/waypoint-classifier.ts` with `classifyWaypoint`, `classifyWaypoints`, `validateSwimPairing`, `detectByWaypoint`
    - Classify by sym values (200=swim-start, 201=swim-end, 3=aid-station) and name patterns ("Début SWIM", "Fin SWIM", "Ravitaillement")
    - Pair Nth swim-start with Nth swim-end in file-appearance order
    - Map waypoints to nearest trackpoint within 50m radius
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 2.7, 2.8, 8.1_

  - [x] 3.2 Write property tests for waypoint classifier
    - **Property 4: Waypoint classification correctness**
    - **Property 6: Unpaired swim-start detection**
    - Create `test/client/waypoint-classifier.test.ts`
    - **Validates: Requirements 2.1, 2.2, 2.8, 8.1**

  - [x] 3.3 Implement segment builder
    - Create `src/client/segment-builder.ts` with `buildSegments`, `pairSegmentsForDisplay`, `formatSegmentDistance`, `calculateTotals`, `roundSwimDistance`, `roundRunDistance`
    - Produce complete, non-overlapping, alternating coverage of all trackpoints
    - Pair segments into display rows: each row has both swim and run distance (ADR-0007, no empty cells)
    - Round swim distances to nearest 50m, run distances to nearest 0.1 km (ADR-0007)
    - Support "swim first" and "run first" column ordering
    - Use "—" for absent values in incomplete pairs (first/last segment)
    - _Requirements: 2.3, 2.4, 2.5, 2.6, 2.7, 3.5, 3.6, 3.7, 5.1, 5.2, 5.3, 5.4, 5.5, 5.7, 5.8_

  - [x] 3.4 Write property tests for segment builder
    - **Property 5: Segmentation produces complete, non-overlapping, alternating coverage**
    - **Property 10: Segment display formatting follows type-specific rules**
    - Create `test/client/segment-builder.test.ts` and `test/client/formatting.test.ts`
    - **Validates: Requirements 2.3, 2.4, 2.5, 2.6, 2.7, 3.5, 3.6, 3.7, 5.1**

- [ ] 4. Checkpoint - Core segmentation
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 5. Implement speed-based segment detection (Strategy 2)
  - [x] 5.1 Implement speed analyzer
    - Create `src/client/speed-analyzer.ts` with `calculateInstantaneousSpeed`, `applySlidingWindow`, `detectBySpeed`, `calculateSpeedConfidence`, `isSpeedDetectionAvailable`
    - Configurable sliding window (default 10, min 3, max 50)
    - Classify <5 kph as swim, ≥5 kph as run, <0.5 kph as stationary (ignored)
    - Require 5 consecutive readings for segment confirmation
    - Place boundary at midpoint of threshold-crossing sequence
    - Skip zero-elapsed-time trackpoints
    - Handle track start/end with fewer than 5 readings by inheriting from nearest adjacent segment
    - _Requirements: 12.1, 12.2, 12.3, 12.4, 12.5, 12.6, 12.7, 12.8, 12.9, 12.10_

  - [x] 5.2 Write property tests for speed analyzer
    - **Property 12: Speed calculation correctness**
    - **Property 13: Sliding window average correctness**
    - **Property 14: Speed-based segment classification follows threshold rules**
    - **Property 15: Speed transition confidence formula**
    - Create `test/client/speed-analyzer.test.ts`
    - **Validates: Requirements 12.1, 12.2, 12.3, 12.4, 12.5, 12.7, 12.8, 12.9**

- [ ] 6. Implement GPS noise filtering
  - [x] 6.1 Implement GPS filter
    - Create `src/client/gps-filter.ts` with `computeScatterRatio`, `detectLateralDeviation`, `filterSwimSegment`, `smoothPath`
    - Compute scatter ratio (cumulative / straight-line distance)
    - Classify noise when scatter ratio > 1.5
    - Apply straight-line replacement when <4 consecutive deviations >20m laterally
    - Apply moving-average smoothing (window 5) when ≥4 consecutive deviations, cap at 120% of straight-line
    - Skip filtering for segments with straight-line distance <5m
    - Never mutate original trackpoint array
    - _Requirements: 13.1, 13.2, 13.3, 13.4, 13.5, 13.6, 13.7, 13.8, 13.10_

  - [x] 6.2 Write property tests for GPS filter
    - **Property 16: GPS filter scatter ratio and method selection**
    - Create `test/client/gps-filter.test.ts`
    - **Validates: Requirements 13.1, 13.3, 13.4, 13.5, 13.6, 13.7, 13.8**

- [ ] 7. Checkpoint - Detection strategies and filtering
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 8. Implement Deno backend service
  - [x] 8.1 Implement cache layer
    - Create `src/server/cache.ts` with `CacheStore` interface, `coordinateCacheKey`, `createCacheStore`
    - Support filesystem and SQLite backends
    - Cache keys at 5 decimal places (~1m resolution)
    - _Requirements: 15.4, 15.9_

  - [x] 8.2 Write property tests for cache keys
    - **Property 22: Cache key determinism and precision**
    - Create `test/server/cache.test.ts`
    - **Validates: Requirements 15.4**

  - [x] 8.3 Implement terrain proxy service
    - Create `src/server/terrain-proxy-service.ts` with `lookupTerrain`, `queryOSM`, `fetchTrackCorridor`, `classifyCoordinates`
    - Single corridor Overpass QL query with `around` statement for water polygons and road/path features
    - Point-in-polygon classification for each coordinate
    - Cache results with 7-day TTL for water, 72-hour TTL for roads
    - _Requirements: 15.1, 15.4, 15.5, 15.7_

  - [x] 8.4 Implement API router and server entry point
    - Create `src/server/router.ts` with `createRouter` and `RouterConfig`
    - Create `src/server/server.ts` with `startServer` and `ServerConfig`
    - Implement endpoints: GET /api/v1/health, GET /api/v1/terrain/lookup, POST /api/v1/terrain/batch
    - Validate request origins against allowed origins list
    - Validate coordinate ranges (lat -90..90, lon -180..180)
    - Enforce max 100 coordinates per batch request
    - Return structured error responses `{ error, code }`
    - Add CORS headers, X-Request-Id, Content-Type: application/json
    - Serve static files in dev mode
    - Log proxied requests (timestamp, target, status) without sensitive payload data
    - _Requirements: 15.1, 15.2, 15.3, 15.5, 15.6, 15.7, 15.8, 15.9_

  - [x] 8.5 Write property tests for backend request validation
    - **Property 19: Backend request validation**
    - Create `test/server/request-validation.test.ts`
    - **Validates: Requirements 15.3, 15.4, 15.8**

- [x] 9. Implement landscape-based detection (Strategy 3) and strategy combination
  - [x] 9.1 Implement landscape client
    - Create `src/client/landscape-client.ts` with `sampleCoordinates`, `queryTerrain`, `detectByLandscape`, `calculateLandscapeConfidence`
    - Sample at intervals ≤ 50m, always include first and last trackpoint
    - Batch requests to backend (max 100 per request)
    - 10-second timeout per request
    - Create segments from 2+ consecutive same-type terrain results
    - Confidence = agreeing points / total points, boosted to ≥0.9 for road data, reduced by 0.1 per unknown point
    - _Requirements: 14.1, 14.2, 14.3, 14.4, 14.5, 14.6, 14.7, 14.8, 14.9_

  - [x] 9.2 Write property tests for landscape detection
    - **Property 17: Coordinate sampling interval constraint**
    - **Property 18: Landscape segment creation from terrain data**
    - Create `test/client/landscape-client.test.ts`
    - **Validates: Requirements 14.2, 14.3, 14.4, 14.5, 14.8, 14.9**

  - [x] 9.3 Implement strategy combiner
    - Create `src/client/strategy-combiner.ts` with `detectApplicableStrategies`, `combineStrategies`, `detectConflicts`
    - Auto-detect applicable strategies from GPXData (waypoints → waypoint strategy, timestamps → speed strategy, coordinates → landscape always)
    - Combine by highest confidence per region
    - Detect boundary conflicts (within 100m for same transition)
    - Mark regions with all confidence <0.3 as "unclassified"
    - Ensure complete, contiguous coverage in output
    - _Requirements: 16.1, 16.2, 16.3, 16.5, 16.9_

  - [x] 9.4 Write property tests for strategy combiner
    - **Property 20: Strategy combination resolves by highest confidence**
    - **Property 21: Strategy applicability auto-detection**
    - Create `test/client/strategy-combiner.test.ts`
    - **Validates: Requirements 16.1, 16.2, 16.3, 16.5, 16.9**

- [x] 10. Checkpoint - All analysis logic complete
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 11. Implement frontend UI layer
  - [ ] 11.1 Create HTML shell and app entry point
    - Create `src/client/index.html` with semantic HTML (main, nav, table, button)
    - Create `src/client/app.ts` as the application entry point managing `AppState`
    - Implement file upload UI with drag-and-drop and file input
    - Wire FileUploadController → GPXParser → strategy execution → rendering pipeline
    - Multi-track selector UI when file has >1 `<trk>` element
    - Strategy toggle settings panel with individual enable/disable controls
    - Re-run segmentation within 5 seconds when strategy toggled
    - Prevent disabling all strategies (show message, retain last results)
    - Show warnings for >50,000 trackpoints (confirm before proceeding) and >100 waypoints
    - Use Web Worker for files with >10,000 trackpoints
    - Error/warning message area above map/table (red=critical, amber=warning)
    - _Requirements: 1.1, 9.1, 9.2, 9.3, 10.1, 10.5, 10.6, 11.1, 11.2, 11.3, 11.5, 16.6, 16.7, 16.8_

  - [ ] 11.2 Implement map renderer
    - Create `src/client/map-renderer.ts` with `initMap`, `renderSegments`, `renderSwimMarkers`, `renderAidStations`, `renderFilteredOverlay`, `fitBounds`
    - Render swim segments as blue polylines, run segments as green polylines
    - Markers at swim-start and swim-end waypoints (visually distinct styles)
    - Aid station markers with distinct icon, tooltip showing "Name X of Y"
    - Tooltip on segment hover: segment number, type, distance (swim in m, run in km)
    - GPS filter overlay: dashed blue for filtered path, semi-transparent scatter for original
    - Fit map bounds to track extent
    - Minimum 3:1 contrast ratio for polylines against map tiles
    - Full track as single polyline when no segments found
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 8.2, 8.3, 8.4, 10.3, 13.9_

  - [ ] 11.3 Implement table renderer
    - Create `src/client/table-renderer.ts` with `renderTable`, `renderEmptyState`, `TableConfig`
    - One row per segment pair (ADR-0007): each row shows both swim and run distance
    - Columns: segment number, swim distance (m), run distance (km) — order toggleable
    - No empty cells: use "—" for absent values in incomplete pairs
    - Toggle for "swim first" / "run first" column order
    - Optional cumulative distance column (toggleable)
    - Totals row (visually distinct) with summed distances
    - Strategy detection label per segment (e.g. "speed + landscape")
    - Conflict indicator when strategies disagree on boundary
    - "No segments found" message for empty state
    - ARIA labels and scope attributes on table headers
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5, 5.6, 5.7, 5.8, 5.9, 10.2, 16.3, 16.4_

  - [ ] 11.4 Implement highlight controller
    - Create `src/client/highlight-controller.ts` with `createHighlightController` returning `HighlightController` interface
    - Click segment on map → highlight table row + scroll into view
    - Click table row → highlight map segment (double line weight, opacity 1.0)
    - Click same segment again → deselect (toggle off)
    - New selection removes previous highlight from both views
    - Keyboard-navigable text-based segment list alternative
    - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5, 6.6, 10.4, 10.5_

  - [ ] 11.5 Write property tests for highlight controller
    - **Property 11: Highlight controller maintains single-selection with toggle**
    - Create `test/client/highlight-controller.test.ts`
    - **Validates: Requirements 6.5, 6.6**

- [ ] 12. Checkpoint - Frontend complete
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 13. Integration, wiring, and Docker deployment
  - [ ] 13.1 Wire full analysis pipeline end-to-end
    - Connect all components: file upload → parse → strategy detection → combine → GPS filter → distance calc → render
    - Ensure landscape strategy queries backend terrain API correctly
    - Verify multi-strategy execution and combination with real test GPX files from `test-data/`
    - _Requirements: 1.2, 16.1, 16.2, 16.5_

  - [ ] 13.2 Create Dockerfile and deployment configuration
    - Create `Dockerfile` for Deno runtime container
    - Configure environment variables (ALLOWED_ORIGINS, OVERPASS_API_URL, CACHE_TYPE, CACHE_PATH, PORT)
    - Set up Caddy reverse proxy config (TLS termination, upstream port `BACKEND_PORT` from `src/server/config.ts`)
    - Verify static file serving from container
    - _Requirements: 15.2, 15.6, 15.9_

  - [ ] 13.3 Write integration tests
    - Create `test/integration/full-pipeline.test.ts` — upload → segments using test GPX files
    - Create `test/integration/multi-strategy.test.ts` — strategy combination with mocked terrain API
    - Create `test/server/terrain-proxy.test.ts` — backend proxy + cache with mocked OSM responses
    - Create `test/server/cors.test.ts` — CORS and origin validation
    - _Requirements: 7.1, 15.3, 15.6, 16.2_

- [ ] 14. Final checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- All tasks are required — this project follows true TDD (tests are not optional)
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- Property tests validate universal correctness properties from the design document (22 properties total)
- Unit tests validate specific examples and edge cases
- The design uses TypeScript with Deno runtime throughout — no language ambiguity
- All analysis logic (GPX parsing, speed analysis, segmentation, GPS filtering, distance calculation) runs client-side in the browser
- The backend is a thin REST/JSON proxy for terrain lookups with caching
- fast-check is used for property-based testing, Deno.test for the test runner
- Web Workers are used for files with >10,000 trackpoints to prevent UI blocking

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1"] },
    { "id": 1, "tasks": ["1.2", "2.1"] },
    { "id": 2, "tasks": ["1.3", "2.2", "2.3"] },
    { "id": 3, "tasks": ["2.4", "3.1", "8.1"] },
    { "id": 4, "tasks": ["3.2", "3.3", "5.1", "8.2", "8.3"] },
    { "id": 5, "tasks": ["3.4", "5.2", "6.1", "8.4"] },
    { "id": 6, "tasks": ["6.2", "8.5", "9.1"] },
    { "id": 7, "tasks": ["9.2", "9.3"] },
    { "id": 8, "tasks": ["9.4", "11.1"] },
    { "id": 9, "tasks": ["11.2", "11.3", "11.4"] },
    { "id": 10, "tasks": ["11.5", "13.1"] },
    { "id": 11, "tasks": ["13.2", "13.3"] }
  ]
}
```
