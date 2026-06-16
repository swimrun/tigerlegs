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
