import type { Coordinate, TerrainResult } from "../shared/types.ts";

/** Cache store interface — filesystem or SQLite backend */
export interface CacheStore {
  get(key: string): Promise<TerrainResult | null>;
  set(key: string, value: TerrainResult, ttlSeconds: number): Promise<void>;
  has(key: string): Promise<boolean>;
  delete(key: string): Promise<void>;
}

/** Internal cache entry with expiry metadata */
interface CacheEntry {
  value: TerrainResult;
  expiresAt: number; // Unix timestamp in milliseconds
}

/**
 * Generate a deterministic cache key from a coordinate at 5 decimal places (~1m resolution).
 * Format: "terrain:{lat_5dp}:{lon_5dp}"
 */
export function coordinateCacheKey(coordinate: Coordinate): string {
  const lat = coordinate.lat.toFixed(5);
  const lon = coordinate.lon.toFixed(5);
  return `terrain:${lat}:${lon}`;
}

/**
 * Encode a cache key as a URL-safe filename.
 * Replaces colons with underscores, dots with dashes for filesystem safety.
 */
function keyToFilename(key: string): string {
  return key
    .replace(/:/g, "_")
    .replace(/\./g, "-") + ".json";
}

/**
 * Create a filesystem-backed cache store.
 * Stores each entry as a separate JSON file in the specified directory.
 */
function createFilesystemCacheStore(dirPath: string): CacheStore {
  // Ensure directory exists (sync on first access is fine for server startup)
  try {
    Deno.mkdirSync(dirPath, { recursive: true });
  } catch {
    // Directory may already exist
  }

  return {
    async get(key: string): Promise<TerrainResult | null> {
      const filePath = `${dirPath}/${keyToFilename(key)}`;
      try {
        const content = await Deno.readTextFile(filePath);
        const entry: CacheEntry = JSON.parse(content);
        // Check TTL
        if (Date.now() > entry.expiresAt) {
          // Expired - clean up and return null
          try {
            await Deno.remove(filePath);
          } catch {
            // Ignore cleanup errors
          }
          return null;
        }
        return entry.value;
      } catch {
        return null;
      }
    },

    async set(key: string, value: TerrainResult, ttlSeconds: number): Promise<void> {
      const filePath = `${dirPath}/${keyToFilename(key)}`;
      const entry: CacheEntry = {
        value,
        expiresAt: Date.now() + ttlSeconds * 1000,
      };
      await Deno.writeTextFile(filePath, JSON.stringify(entry));
    },

    async has(key: string): Promise<boolean> {
      const result = await this.get(key);
      return result !== null;
    },

    async delete(key: string): Promise<void> {
      const filePath = `${dirPath}/${keyToFilename(key)}`;
      try {
        await Deno.remove(filePath);
      } catch {
        // File may not exist
      }
    },
  };
}

/**
 * Create a SQLite-backed cache store.
 * Uses a single database file with a terrain_cache table.
 */
function createSqliteCacheStore(dbPath: string): CacheStore {
  // SQLite implementation placeholder - requires @db/sqlite dependency
  // For now, throw an error indicating SQLite is not yet configured
  throw new Error(
    `SQLite cache backend requires @db/sqlite dependency. ` +
    `Requested path: ${dbPath}. Use "filesystem" backend instead.`
  );
}

/**
 * Create a cache store instance.
 * @param type - "filesystem" or "sqlite"
 * @param path - directory path for filesystem, or db file path for sqlite
 */
export function createCacheStore(type: "filesystem" | "sqlite", path: string): CacheStore {
  switch (type) {
    case "filesystem":
      return createFilesystemCacheStore(path);
    case "sqlite":
      return createSqliteCacheStore(path);
    default:
      throw new Error(`Unknown cache type: ${type}`);
  }
}
