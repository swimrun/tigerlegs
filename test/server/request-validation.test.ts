/**
 * Property 19: Backend request validation
 * **Validates: Requirements 15.3, 15.4, 15.8**
 *
 * Tests that the router correctly validates:
 * - Coordinate ranges (lat [-90,90], lon [-180,180])
 * - Batch size limits (max 100 coordinates)
 * - Origin-based access control
 */

import fc from "fast-check";
import { assertEquals, assert } from "@std/assert";
import { createRouter, type RouterConfig } from "../../src/server/router.ts";
import type { CacheStore } from "../../src/server/cache.ts";
import type { TerrainResult } from "../../src/shared/types.ts";
import { BACKEND_ORIGIN, FRONTEND_ORIGIN, PRODUCTION_ORIGIN } from "../../src/server/config.ts";

const TERRAIN_LOOKUP_URL = `${BACKEND_ORIGIN}/api/v1/terrain/lookup`;
const TERRAIN_BATCH_URL = `${BACKEND_ORIGIN}/api/v1/terrain/batch`;

const STATUS_BAD_REQUEST = 400;
const STATUS_FORBIDDEN = 403;
const CODE_INVALID_COORDINATES = "INVALID_COORDINATES";
const CODE_BATCH_TOO_LARGE = "BATCH_TOO_LARGE";
const CODE_FORBIDDEN_ORIGIN = "FORBIDDEN_ORIGIN";

// --- Test helpers ---

/** Minimal in-memory mock CacheStore */
function createMockCacheStore(): CacheStore {
  const store = new Map<string, TerrainResult>();
  return {
    get(key: string): Promise<TerrainResult | null> {
      return Promise.resolve(store.get(key) ?? null);
    },
    set(key: string, value: TerrainResult, _ttl: number): Promise<void> {
      store.set(key, value);
      return Promise.resolve();
    },
    has(key: string): Promise<boolean> {
      return Promise.resolve(store.has(key));
    },
    delete(key: string): Promise<void> {
      store.delete(key);
      return Promise.resolve();
    },
  };
}

const ALLOWED_ORIGINS = [FRONTEND_ORIGIN, PRODUCTION_ORIGIN];

function lookupRequest(lat: number, lon: number, origin: string = FRONTEND_ORIGIN): Request {
  return new Request(`${TERRAIN_LOOKUP_URL}?lat=${lat}&lon=${lon}`, {
    headers: { Origin: origin },
  });
}

function createTestRouter() {
  const config: RouterConfig = {
    allowedOrigins: ALLOWED_ORIGINS,
    cacheStore: createMockCacheStore(),
  };
  return createRouter(config);
}

/**
 * Mock globalThis.fetch to return a dummy Overpass response so that
 * valid coordinate requests don't fail with network errors.
 */
function withMockFetch<T>(fn: () => Promise<T>): Promise<T> {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = (_input: string | URL | Request, _init?: RequestInit) => {
    // Return a dummy Overpass API response indicating "land" terrain
    const body = JSON.stringify({
      elements: [{ type: "way", id: 1, tags: { natural: "wood" } }],
    });
    return Promise.resolve(new Response(body, { status: 200 }));
  };
  return fn().finally(() => {
    globalThis.fetch = originalFetch;
  });
}

// --- Property 19.1: Invalid latitude always rejected ---

Deno.test("Property 19.1: Any coordinate with lat outside [-90, 90] is always rejected (400 INVALID_COORDINATES)", async () => {
  const handler = createTestRouter();

  await fc.assert(
    fc.asyncProperty(
      // Generate latitudes strictly outside [-90, 90]
      fc.oneof(
        fc.double({ min: 90.00001, max: 1000, noNaN: true }),
        fc.double({ min: -1000, max: -90.00001, noNaN: true }),
      ),
      // Any valid longitude for the request
      fc.double({ min: -180, max: 180, noNaN: true }),
      async (invalidLat, lon) => {
        const request = lookupRequest(invalidLat, lon);
        const response = await handler(request);
        const body = await response.json();

        assertEquals(response.status, STATUS_BAD_REQUEST);
        assertEquals(body.code, CODE_INVALID_COORDINATES);
      },
    ),
    { numRuns: 100 },
  );
});

// --- Property 19.2: Invalid longitude always rejected ---

Deno.test("Property 19.2: Any coordinate with lon outside [-180, 180] is always rejected (400 INVALID_COORDINATES)", async () => {
  const handler = createTestRouter();

  await fc.assert(
    fc.asyncProperty(
      // Any valid latitude for the request
      fc.double({ min: -90, max: 90, noNaN: true }),
      // Generate longitudes strictly outside [-180, 180]
      fc.oneof(
        fc.double({ min: 180.00001, max: 1000, noNaN: true }),
        fc.double({ min: -1000, max: -180.00001, noNaN: true }),
      ),
      async (lat, invalidLon) => {
        const request = lookupRequest(lat, invalidLon);
        const response = await handler(request);
        const body = await response.json();

        assertEquals(response.status, STATUS_BAD_REQUEST);
        assertEquals(body.code, CODE_INVALID_COORDINATES);
      },
    ),
    { numRuns: 100 },
  );
});

// --- Property 19.3: Valid coordinates are never rejected with INVALID_COORDINATES ---

Deno.test({
  name: "Property 19.3: Valid coordinates (lat in [-90,90], lon in [-180,180]) are never rejected with INVALID_COORDINATES",
  sanitizeResources: false,
  fn: async () => {
    const handler = createTestRouter();

    await withMockFetch(async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.double({ min: -90, max: 90, noNaN: true }),
          fc.double({ min: -180, max: 180, noNaN: true }),
          async (lat, lon) => {
            const request = lookupRequest(lat, lon);
            const response = await handler(request);
            const body = await response.json();

            // Valid coordinates should never result in INVALID_COORDINATES error
            if (response.status === STATUS_BAD_REQUEST) {
              assert(
                body.code !== CODE_INVALID_COORDINATES,
                `Valid coords lat=${lat}, lon=${lon} were incorrectly rejected with INVALID_COORDINATES`,
              );
            }
          },
        ),
        { numRuns: 100 },
      );
    });
  },
});

// --- Property 19.4: Batch requests with >100 coordinates always rejected ---

Deno.test("Property 19.4: Batch requests with >100 coordinates are always rejected (400 BATCH_TOO_LARGE)", async () => {
  const handler = createTestRouter();

  await fc.assert(
    fc.asyncProperty(
      // Generate batch size between 101 and 300
      fc.integer({ min: 101, max: 300 }),
      async (batchSize) => {
        const coordinates = Array.from({ length: batchSize }, (_, i) => ({
          lat: (i % 180) - 90 + 0.5, // valid lats
          lon: (i % 360) - 180 + 0.5, // valid lons
        }));

        const request = new Request(TERRAIN_BATCH_URL, {
          method: "POST",
          headers: {
            Origin: FRONTEND_ORIGIN,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ coordinates }),
        });
        const response = await handler(request);
        const body = await response.json();

        assertEquals(response.status, STATUS_BAD_REQUEST);
        assertEquals(body.code, CODE_BATCH_TOO_LARGE);
      },
    ),
    { numRuns: 50 },
  );
});

// --- Property 19.5: Requests from non-allowed origins always get 403 ---

Deno.test("Property 19.5: Requests from non-allowed origins always get 403 (FORBIDDEN_ORIGIN)", async () => {
  const handler = createTestRouter();

  // Generator for origin strings that are never in ALLOWED_ORIGINS
  const arbitraryForbiddenOrigin = fc
    .webUrl()
    .filter((url) => !ALLOWED_ORIGINS.includes(url));

  await fc.assert(
    fc.asyncProperty(
      arbitraryForbiddenOrigin,
      async (forbiddenOrigin) => {
        const request = lookupRequest(45, 6, forbiddenOrigin);
        const response = await handler(request);
        const body = await response.json();

        assertEquals(response.status, STATUS_FORBIDDEN);
        assertEquals(body.code, CODE_FORBIDDEN_ORIGIN);
      },
    ),
    { numRuns: 100 },
  );
});

// --- Property 19.6: Requests from allowed origins never get 403 ---

Deno.test({
  name: "Property 19.6: Requests from allowed origins never get 403 (FORBIDDEN_ORIGIN)",
  sanitizeResources: false,
  fn: async () => {
    const handler = createTestRouter();

    await withMockFetch(async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.constantFrom(...ALLOWED_ORIGINS),
          async (allowedOrigin) => {
            const request = lookupRequest(45, 6, allowedOrigin);
            const response = await handler(request);

            assert(
              response.status !== STATUS_FORBIDDEN,
              `Allowed origin ${allowedOrigin} was rejected with 403`,
            );
            // Consume the body to avoid resource leaks
            await response.text();
          },
        ),
        { numRuns: 50 },
      );
    });
  },
});
