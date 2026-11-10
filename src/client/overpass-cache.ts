/**
 * Browser cache for Overpass answers. Water data for an area changes rarely, and the query area is
 * a coarse grid cell, so a second analysis near the same place needs no request at all. The cache
 * holds public OpenStreetMap data only, never GPX content, and stays on this device.
 */
export interface OverpassCache {
  get(key: string): Promise<unknown | undefined>;
  set(key: string, json: unknown): Promise<void>;
}

const CACHE_NAME = "tigerlegs-overpass-v1";
export const CACHE_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;
const keyUrl = (key: string) => `https://cache.tigerlegs.invalid/overpass/${encodeURIComponent(key)}`;

/** The Cache API cache, or null where the browser has none (or blocks it). */
export function browserOverpassCache(
  storage: CacheStorage | null = globalThis.caches ?? null,
  now: () => number = Date.now,
): OverpassCache | null {
  if (!storage) return null;
  return {
    async get(key) {
      try {
        const cache = await storage.open(CACHE_NAME);
        const hit = await cache.match(keyUrl(key));
        if (!hit) return undefined;
        if (now() - Number(hit.headers.get("x-cached-at")) > CACHE_MAX_AGE_MS) {
          await cache.delete(keyUrl(key));
          return undefined;
        }
        return await hit.json();
      } catch {
        return undefined;
      }
    },
    async set(key, json) {
      try {
        const cache = await storage.open(CACHE_NAME);
        await cache.put(
          keyUrl(key),
          new Response(JSON.stringify(json), { headers: { "x-cached-at": String(now()) } }),
        );
      } catch {
        // A full or blocked cache only means the next analysis asks again.
      }
    },
  };
}
