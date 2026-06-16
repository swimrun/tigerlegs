import { assertEquals, assertNotEquals } from "@std/assert";
import type { Coordinate, TerrainResult } from "../../src/shared/types.ts";
import {
  coordinateCacheKey,
  createCacheStore,
  type CacheStore,
} from "../../src/server/cache.ts";

// --- Unit Tests for coordinateCacheKey ---

Deno.test("coordinateCacheKey - produces deterministic key for same coordinate", () => {
  const coord: Coordinate = { lat: 45.12345, lon: 5.67890 };
  const key1 = coordinateCacheKey(coord);
  const key2 = coordinateCacheKey(coord);
  assertEquals(key1, key2);
});

Deno.test("coordinateCacheKey - rounds to 5 decimal places", () => {
  // Both coords differ only at 6th+ decimal place, should produce same key
  const coord1: Coordinate = { lat: 45.123451111, lon: 5.678901111 };
  const coord2: Coordinate = { lat: 45.123454999, lon: 5.678904999 };
  assertEquals(coordinateCacheKey(coord1), coordinateCacheKey(coord2));
});

Deno.test("coordinateCacheKey - different coords at 5dp produce different keys", () => {
  const coord1: Coordinate = { lat: 45.12345, lon: 5.67890 };
  const coord2: Coordinate = { lat: 45.12346, lon: 5.67890 };
  assertNotEquals(coordinateCacheKey(coord1), coordinateCacheKey(coord2));
});

Deno.test("coordinateCacheKey - format is terrain:{lat}:{lon}", () => {
  const coord: Coordinate = { lat: 45.12345, lon: 5.67890 };
  const key = coordinateCacheKey(coord);
  assertEquals(key, "terrain:45.12345:5.67890");
});

Deno.test("coordinateCacheKey - handles negative coordinates", () => {
  const coord: Coordinate = { lat: -33.86785, lon: -151.20732 };
  const key = coordinateCacheKey(coord);
  assertEquals(key, "terrain:-33.86785:-151.20732");
});

Deno.test("coordinateCacheKey - pads zeros to 5 decimal places", () => {
  const coord: Coordinate = { lat: 45.1, lon: 5.6 };
  const key = coordinateCacheKey(coord);
  assertEquals(key, "terrain:45.10000:5.60000");
});

// --- Filesystem CacheStore tests ---

Deno.test("filesystem cache - get returns null for non-existent key", async () => {
  const tmpDir = await Deno.makeTempDir();
  try {
    const cache = createCacheStore("filesystem", tmpDir);
    const result = await cache.get("terrain:45.12345:5.67890");
    assertEquals(result, null);
  } finally {
    await Deno.remove(tmpDir, { recursive: true });
  }
});

Deno.test("filesystem cache - set and get retrieves value", async () => {
  const tmpDir = await Deno.makeTempDir();
  try {
    const cache = createCacheStore("filesystem", tmpDir);
    const terrainResult: TerrainResult = {
      coordinate: { lat: 45.12345, lon: 5.67890 },
      terrainType: "water",
      hasRoadData: false,
    };
    await cache.set("terrain:45.12345:5.67890", terrainResult, 3600);
    const retrieved = await cache.get("terrain:45.12345:5.67890");
    assertEquals(retrieved, terrainResult);
  } finally {
    await Deno.remove(tmpDir, { recursive: true });
  }
});

Deno.test("filesystem cache - has returns true for existing key", async () => {
  const tmpDir = await Deno.makeTempDir();
  try {
    const cache = createCacheStore("filesystem", tmpDir);
    const terrainResult: TerrainResult = {
      coordinate: { lat: 45.12345, lon: 5.67890 },
      terrainType: "land",
      hasRoadData: true,
    };
    await cache.set("terrain:45.12345:5.67890", terrainResult, 3600);
    const exists = await cache.has("terrain:45.12345:5.67890");
    assertEquals(exists, true);
  } finally {
    await Deno.remove(tmpDir, { recursive: true });
  }
});

Deno.test("filesystem cache - has returns false for non-existent key", async () => {
  const tmpDir = await Deno.makeTempDir();
  try {
    const cache = createCacheStore("filesystem", tmpDir);
    const exists = await cache.has("terrain:99.99999:99.99999");
    assertEquals(exists, false);
  } finally {
    await Deno.remove(tmpDir, { recursive: true });
  }
});

Deno.test("filesystem cache - delete removes entry", async () => {
  const tmpDir = await Deno.makeTempDir();
  try {
    const cache = createCacheStore("filesystem", tmpDir);
    const terrainResult: TerrainResult = {
      coordinate: { lat: 45.12345, lon: 5.67890 },
      terrainType: "water",
      hasRoadData: false,
    };
    await cache.set("terrain:45.12345:5.67890", terrainResult, 3600);
    await cache.delete("terrain:45.12345:5.67890");
    const result = await cache.get("terrain:45.12345:5.67890");
    assertEquals(result, null);
  } finally {
    await Deno.remove(tmpDir, { recursive: true });
  }
});

Deno.test("filesystem cache - expired entries return null", async () => {
  const tmpDir = await Deno.makeTempDir();
  try {
    const cache = createCacheStore("filesystem", tmpDir);
    const terrainResult: TerrainResult = {
      coordinate: { lat: 45.12345, lon: 5.67890 },
      terrainType: "water",
      hasRoadData: false,
    };
    // Set with 0 TTL (immediately expired)
    await cache.set("terrain:45.12345:5.67890", terrainResult, 0);
    // Small delay to ensure expiry
    await new Promise((resolve) => setTimeout(resolve, 10));
    const result = await cache.get("terrain:45.12345:5.67890");
    assertEquals(result, null);
  } finally {
    await Deno.remove(tmpDir, { recursive: true });
  }
});

Deno.test("filesystem cache - non-expired entries are returned", async () => {
  const tmpDir = await Deno.makeTempDir();
  try {
    const cache = createCacheStore("filesystem", tmpDir);
    const terrainResult: TerrainResult = {
      coordinate: { lat: 45.12345, lon: 5.67890 },
      terrainType: "land",
      hasRoadData: true,
    };
    // Set with large TTL
    await cache.set("terrain:45.12345:5.67890", terrainResult, 86400);
    const result = await cache.get("terrain:45.12345:5.67890");
    assertEquals(result, terrainResult);
  } finally {
    await Deno.remove(tmpDir, { recursive: true });
  }
});


// --- Property-Based Tests for coordinateCacheKey (Property 22) ---
// **Validates: Requirements 15.4**

import fc from "fast-check";
import { arbitraryCoordinate } from "../generators.ts";

Deno.test("Property 22.1: Same coordinate always produces the same key (deterministic)", () => {
  fc.assert(
    fc.property(arbitraryCoordinate, (coord) => {
      const key1 = coordinateCacheKey(coord);
      const key2 = coordinateCacheKey(coord);
      assertEquals(key1, key2);
    }),
    { numRuns: 200 },
  );
});

Deno.test("Property 22.2: Coordinates differing only beyond 5th decimal place produce the same key", () => {
  // toFixed(5) rounds at the 5th decimal place. A perturbation beyond 5dp
  // will only produce the same key if the original value is NOT sitting on
  // a rounding boundary. We test this by ensuring the perturbation doesn't
  // cross a 5dp rounding threshold: both values must round to the same 5dp.
  fc.assert(
    fc.property(
      fc.record({
        lat: fc.double({ min: -90, max: 90, noNaN: true }),
        lon: fc.double({ min: -180, max: 180, noNaN: true }),
      }),
      (coord) => {
        // Create a coordinate that differs only beyond the 5th decimal place
        // by reconstructing from the 5dp-rounded value + a sub-5dp offset.
        // This guarantees both coordinates share the same 5dp representation.
        const lat5dp = parseFloat(coord.lat.toFixed(5));
        const lon5dp = parseFloat(coord.lon.toFixed(5));

        // Reconstruct two coordinates that both have the same 5dp representation
        const coord1 = { lat: lat5dp + 0.000001, lon: lon5dp + 0.000001 };
        const coord2 = { lat: lat5dp + 0.000004, lon: lon5dp + 0.000004 };

        // Skip if out of range
        if (
          coord1.lat < -90 || coord1.lat > 90 || coord1.lon < -180 || coord1.lon > 180 ||
          coord2.lat < -90 || coord2.lat > 90 || coord2.lon < -180 || coord2.lon > 180
        ) {
          return true;
        }

        const key1 = coordinateCacheKey(coord1);
        const key2 = coordinateCacheKey(coord2);
        assertEquals(key1, key2);
      },
    ),
    { numRuns: 200 },
  );
});

Deno.test("Property 22.3: Coordinates differing at the 5th decimal place produce different keys", () => {
  fc.assert(
    fc.property(
      // Use a coordinate range that avoids boundary overflow when adding 0.00001
      fc.record({
        lat: fc.double({ min: -89.99999, max: 89.99998, noNaN: true }),
        lon: fc.double({ min: -179.99999, max: 179.99998, noNaN: true }),
      }),
      fc.constantFrom("lat", "lon") as fc.Arbitrary<"lat" | "lon">,
      (coord, axis) => {
        // Shift by exactly 1 unit at the 5th decimal place (0.00001)
        const shifted = { ...coord };
        shifted[axis] = coord[axis] + 0.00001;

        const key1 = coordinateCacheKey(coord);
        const key2 = coordinateCacheKey(shifted);
        assertNotEquals(key1, key2);
      },
    ),
    { numRuns: 200 },
  );
});

Deno.test("Property 22.4: Key format is always 'terrain:{lat}:{lon}' with exactly 5 decimal digits", () => {
  // Regex: terrain: followed by optional minus, digits, dot, exactly 5 digits,
  // colon, optional minus, digits, dot, exactly 5 digits
  const keyPattern = /^terrain:-?\d+\.\d{5}:-?\d+\.\d{5}$/;

  fc.assert(
    fc.property(arbitraryCoordinate, (coord) => {
      const key = coordinateCacheKey(coord);
      assertEquals(keyPattern.test(key), true, `Key "${key}" does not match expected format`);
    }),
    { numRuns: 200 },
  );
});
