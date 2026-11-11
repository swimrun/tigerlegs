import { expect, it } from "vitest";
import type { Coordinate, TerrainResult } from "../../src/shared/types.ts";
import type { CacheStore } from "../../src/server/cache.ts";
import {
  classifyCoordinates,
  fetchTrackCorridor,
  lookupTerrain,
  pointInPolygon,
  queryOSM,
  type CorridorFeatures,
  type GeoPolygon,
} from "../../src/server/terrain-proxy-service.ts";

// --- Helper: In-memory CacheStore for testing ---

function createInMemoryCache(): CacheStore & { store: Map<string, { value: TerrainResult; expiresAt: number }> } {
  const store = new Map<string, { value: TerrainResult; expiresAt: number }>();
  return {
    store,
    async get(key: string): Promise<TerrainResult | null> {
      const entry = store.get(key);
      if (!entry) return null;
      if (Date.now() > entry.expiresAt) {
        store.delete(key);
        return null;
      }
      return entry.value;
    },
    async set(key: string, value: TerrainResult, ttlSeconds: number): Promise<void> {
      store.set(key, { value, expiresAt: Date.now() + ttlSeconds * 1000 });
    },
    async has(key: string): Promise<boolean> {
      const result = await this.get(key);
      return result !== null;
    },
    async delete(key: string): Promise<void> {
      store.delete(key);
    },
  };
}

// --- Unit Tests for pointInPolygon (ray casting) ---

it("pointInPolygon - point inside a simple square", () => {
  const polygon: Coordinate[] = [
    { lat: 0, lon: 0 },
    { lat: 0, lon: 1 },
    { lat: 1, lon: 1 },
    { lat: 1, lon: 0 },
  ];
  const point: Coordinate = { lat: 0.5, lon: 0.5 };
  expect(pointInPolygon(point, polygon)).toEqual(true);
});

it("pointInPolygon - point outside a simple square", () => {
  const polygon: Coordinate[] = [
    { lat: 0, lon: 0 },
    { lat: 0, lon: 1 },
    { lat: 1, lon: 1 },
    { lat: 1, lon: 0 },
  ];
  const point: Coordinate = { lat: 2, lon: 2 };
  expect(pointInPolygon(point, polygon)).toEqual(false);
});

it("pointInPolygon - point inside a triangle", () => {
  const polygon: Coordinate[] = [
    { lat: 0, lon: 0 },
    { lat: 0, lon: 4 },
    { lat: 3, lon: 2 },
  ];
  const point: Coordinate = { lat: 1, lon: 2 };
  expect(pointInPolygon(point, polygon)).toEqual(true);
});

it("pointInPolygon - point outside a triangle", () => {
  const polygon: Coordinate[] = [
    { lat: 0, lon: 0 },
    { lat: 0, lon: 4 },
    { lat: 3, lon: 2 },
  ];
  const point: Coordinate = { lat: 0, lon: 5 };
  expect(pointInPolygon(point, polygon)).toEqual(false);
});

it("pointInPolygon - point on edge (treated as outside by ray casting)", () => {
  const polygon: Coordinate[] = [
    { lat: 0, lon: 0 },
    { lat: 0, lon: 2 },
    { lat: 2, lon: 2 },
    { lat: 2, lon: 0 },
  ];
  // Point exactly on the bottom edge
  const point: Coordinate = { lat: 0, lon: 1 };
  // Ray casting may or may not include edge points - implementation-defined
  // We just verify it returns a boolean without crashing
  const result = pointInPolygon(point, polygon);
  expect(typeof result).toEqual("boolean");
});

it("pointInPolygon - degenerate polygon with fewer than 3 vertices returns false", () => {
  // A line (2 points) is not a valid polygon
  const line: Coordinate[] = [
    { lat: 0, lon: 0 },
    { lat: 1, lon: 1 },
  ];
  const point: Coordinate = { lat: 0.5, lon: 0.5 };
  expect(pointInPolygon(point, line)).toEqual(false);

  // A single point is not a valid polygon
  const single: Coordinate[] = [{ lat: 0, lon: 0 }];
  expect(pointInPolygon(point, single)).toEqual(false);

  // Empty polygon
  const empty: Coordinate[] = [];
  expect(pointInPolygon(point, empty)).toEqual(false);
});

// --- Unit Tests for classifyCoordinates ---

it("classifyCoordinates - point inside water polygon classified as water", () => {
  const coordinates: Coordinate[] = [{ lat: 0.5, lon: 0.5 }];
  const corridor: CorridorFeatures = {
    waterPolygons: [
      {
        coordinates: [
          { lat: 0, lon: 0 },
          { lat: 0, lon: 1 },
          { lat: 1, lon: 1 },
          { lat: 1, lon: 0 },
        ],
        tags: { natural: "water" },
      },
    ],
    roads: [],
    paths: [],
  };

  const results = classifyCoordinates(coordinates, corridor);
  expect(results.length).toEqual(1);
  expect(results[0].terrainType).toEqual("water");
  expect(results[0].hasRoadData).toEqual(false);
});

it("classifyCoordinates - point outside water polygon classified as land", () => {
  const coordinates: Coordinate[] = [{ lat: 5, lon: 5 }];
  const corridor: CorridorFeatures = {
    waterPolygons: [
      {
        coordinates: [
          { lat: 0, lon: 0 },
          { lat: 0, lon: 1 },
          { lat: 1, lon: 1 },
          { lat: 1, lon: 0 },
        ],
        tags: { natural: "water" },
      },
    ],
    roads: [],
    paths: [],
  };

  const results = classifyCoordinates(coordinates, corridor);
  expect(results.length).toEqual(1);
  expect(results[0].terrainType).toEqual("land");
  expect(results[0].hasRoadData).toEqual(false);
});

it("classifyCoordinates - point near road classified as land with hasRoadData=true", () => {
  // Road runs along lon=5, from lat=0 to lat=10
  const coordinates: Coordinate[] = [{ lat: 5, lon: 5.00005 }]; // Very close to road
  const corridor: CorridorFeatures = {
    waterPolygons: [],
    roads: [
      {
        coordinates: [
          { lat: 0, lon: 5 },
          { lat: 10, lon: 5 },
        ],
        tags: { highway: "residential" },
      },
    ],
    paths: [],
  };

  const results = classifyCoordinates(coordinates, corridor);
  expect(results.length).toEqual(1);
  expect(results[0].terrainType).toEqual("land");
  expect(results[0].hasRoadData).toEqual(true);
});

it("classifyCoordinates - point far from road has no road data", () => {
  // Road at lon=5, point at lon=5.5 (~55km away at equator, well beyond 10m)
  const coordinates: Coordinate[] = [{ lat: 5, lon: 5.5 }];
  const corridor: CorridorFeatures = {
    waterPolygons: [],
    roads: [
      {
        coordinates: [
          { lat: 0, lon: 5 },
          { lat: 10, lon: 5 },
        ],
        tags: { highway: "residential" },
      },
    ],
    paths: [],
  };

  const results = classifyCoordinates(coordinates, corridor);
  expect(results.length).toEqual(1);
  expect(results[0].terrainType).toEqual("land");
  expect(results[0].hasRoadData).toEqual(false);
});

it("classifyCoordinates - empty corridor defaults to land", () => {
  const coordinates: Coordinate[] = [
    { lat: 45.0, lon: 5.0 },
    { lat: 45.1, lon: 5.1 },
  ];
  const corridor: CorridorFeatures = {
    waterPolygons: [],
    roads: [],
    paths: [],
  };

  const results = classifyCoordinates(coordinates, corridor);
  expect(results.length).toEqual(2);
  for (const r of results) {
    expect(r.terrainType).toEqual("land");
    expect(r.hasRoadData).toEqual(false);
  }
});

it("classifyCoordinates - water takes priority over road proximity", () => {
  // Point is inside water AND near a road - water should win
  const coordinates: Coordinate[] = [{ lat: 0.5, lon: 0.5 }];
  const corridor: CorridorFeatures = {
    waterPolygons: [
      {
        coordinates: [
          { lat: 0, lon: 0 },
          { lat: 0, lon: 1 },
          { lat: 1, lon: 1 },
          { lat: 1, lon: 0 },
        ],
        tags: { natural: "water" },
      },
    ],
    roads: [
      {
        coordinates: [
          { lat: 0.5, lon: 0 },
          { lat: 0.5, lon: 1 },
        ],
        tags: { highway: "residential" },
      },
    ],
    paths: [],
  };

  const results = classifyCoordinates(coordinates, corridor);
  expect(results[0].terrainType).toEqual("water");
  expect(results[0].hasRoadData).toEqual(false);
});

it("classifyCoordinates - multiple coordinates classified correctly", () => {
  const coordinates: Coordinate[] = [
    { lat: 0.5, lon: 0.5 }, // inside water
    { lat: 5, lon: 6 },     // outside water, far from road (1 degree away ~ 111km)
    { lat: 5, lon: 5.00005 }, // near a road
  ];
  const corridor: CorridorFeatures = {
    waterPolygons: [
      {
        coordinates: [
          { lat: 0, lon: 0 },
          { lat: 0, lon: 1 },
          { lat: 1, lon: 1 },
          { lat: 1, lon: 0 },
        ],
        tags: { natural: "water" },
      },
    ],
    roads: [
      {
        coordinates: [
          { lat: 4, lon: 5 },
          { lat: 6, lon: 5 },
        ],
        tags: { highway: "residential" },
      },
    ],
    paths: [],
  };

  const results = classifyCoordinates(coordinates, corridor);
  expect(results[0].terrainType).toEqual("water");
  expect(results[1].terrainType).toEqual("land");
  expect(results[1].hasRoadData).toEqual(false);
  expect(results[2].terrainType).toEqual("land");
  expect(results[2].hasRoadData).toEqual(true);
});

// --- Unit Tests for lookupTerrain (with cache) ---

it("lookupTerrain - returns cached results for cached coordinates", async () => {
  const cache = createInMemoryCache();
  const coord: Coordinate = { lat: 45.12345, lon: 5.67890 };
  const cachedResult: TerrainResult = {
    coordinate: coord,
    terrainType: "water",
    hasRoadData: false,
  };
  await cache.set("terrain:45.12345:5.67890", cachedResult, 604800);

  // Mock global fetch to fail if called (should not be called since cache hit)
  const originalFetch = globalThis.fetch;
  globalThis.fetch = () => {
    throw new Error("fetch should not be called for cached coordinates");
  };

  try {
    const results = await lookupTerrain([coord], cache);
    expect(results.length).toEqual(1);
    expect(results[0].terrainType).toEqual("water");
  } finally {
    globalThis.fetch = originalFetch;
  }
});

it("lookupTerrain - queries OSM for cache misses and stores results", async () => {
  const cache = createInMemoryCache();
  const coord: Coordinate = { lat: 45.12345, lon: 5.67890 };

  // Mock fetch to return empty Overpass response (no water)
  const originalFetch = globalThis.fetch;
  globalThis.fetch = (_url: string | URL | Request, _init?: RequestInit) => {
    return Promise.resolve(
      new Response(JSON.stringify({ elements: [] }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );
  };

  try {
    const results = await lookupTerrain([coord], cache);
    expect(results.length).toEqual(1);
    expect(results[0].terrainType).toEqual("land");
    expect(results[0].hasRoadData).toEqual(false);

    // Verify it was cached
    const cached = await cache.get("terrain:45.12345:5.67890");
    expect(cached?.terrainType).toEqual("land");
  } finally {
    globalThis.fetch = originalFetch;
  }
});

// --- Unit Tests for queryOSM (convenience wrapper) ---

it("queryOSM - returns terrain results without caching", async () => {
  const coord: Coordinate = { lat: 45.12345, lon: 5.67890 };

  // Mock fetch to return a water polygon
  const originalFetch = globalThis.fetch;
  globalThis.fetch = (_url: string | URL | Request, _init?: RequestInit) => {
    const overpassResponse = {
      elements: [
        {
          type: "way",
          id: 12345,
          tags: { natural: "water" },
          geometry: [
            { lat: 45.123, lon: 5.678 },
            { lat: 45.123, lon: 5.680 },
            { lat: 45.124, lon: 5.680 },
            { lat: 45.124, lon: 5.678 },
            { lat: 45.123, lon: 5.678 },
          ],
        },
      ],
    };
    return Promise.resolve(
      new Response(JSON.stringify(overpassResponse), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );
  };

  try {
    const results = await queryOSM([coord]);
    expect(results.length).toEqual(1);
    // Point is inside the water polygon
    expect(results[0].terrainType).toEqual("water");
  } finally {
    globalThis.fetch = originalFetch;
  }
});

// --- Unit Tests for fetchTrackCorridor ---

it("fetchTrackCorridor - parses Overpass response into CorridorFeatures", async () => {
  const coordinates: Coordinate[] = [
    { lat: 45.123, lon: 5.678 },
    { lat: 45.124, lon: 5.679 },
  ];

  const overpassResponse = {
    elements: [
      {
        type: "way",
        id: 100,
        tags: { natural: "water" },
        geometry: [
          { lat: 45.1230, lon: 5.6780 },
          { lat: 45.1230, lon: 5.6800 },
          { lat: 45.1240, lon: 5.6800 },
          { lat: 45.1240, lon: 5.6780 },
          { lat: 45.1230, lon: 5.6780 },
        ],
      },
      {
        type: "way",
        id: 200,
        tags: { highway: "residential" },
        geometry: [
          { lat: 45.1235, lon: 5.6785 },
          { lat: 45.1245, lon: 5.6795 },
        ],
      },
      {
        type: "way",
        id: 300,
        tags: { highway: "path" },
        geometry: [
          { lat: 45.1232, lon: 5.6782 },
          { lat: 45.1242, lon: 5.6792 },
        ],
      },
    ],
  };

  const originalFetch = globalThis.fetch;
  globalThis.fetch = (_url: string | URL | Request, _init?: RequestInit) => {
    return Promise.resolve(
      new Response(JSON.stringify(overpassResponse), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );
  };

  try {
    const corridor = await fetchTrackCorridor(coordinates, 30);
    expect(corridor.waterPolygons.length).toEqual(1);
    expect(corridor.waterPolygons[0].tags.natural).toEqual("water");
    expect(corridor.roads.length).toEqual(1);
    expect(corridor.roads[0].tags.highway).toEqual("residential");
    expect(corridor.paths.length).toEqual(1);
    expect(corridor.paths[0].tags.highway).toEqual("path");
  } finally {
    globalThis.fetch = originalFetch;
  }
});

it("fetchTrackCorridor - handles empty Overpass response", async () => {
  const coordinates: Coordinate[] = [{ lat: 45.0, lon: 5.0 }];

  const originalFetch = globalThis.fetch;
  globalThis.fetch = (_url: string | URL | Request, _init?: RequestInit) => {
    return Promise.resolve(
      new Response(JSON.stringify({ elements: [] }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );
  };

  try {
    const corridor = await fetchTrackCorridor(coordinates);
    expect(corridor.waterPolygons.length).toEqual(0);
    expect(corridor.roads.length).toEqual(0);
    expect(corridor.paths.length).toEqual(0);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

it("fetchTrackCorridor - handles relation elements with members", async () => {
  const coordinates: Coordinate[] = [{ lat: 45.0, lon: 5.0 }];

  const overpassResponse = {
    elements: [
      {
        type: "relation",
        id: 500,
        tags: { natural: "water", type: "multipolygon" },
        members: [
          {
            type: "way",
            role: "outer",
            geometry: [
              { lat: 44.99, lon: 4.99 },
              { lat: 44.99, lon: 5.01 },
              { lat: 45.01, lon: 5.01 },
              { lat: 45.01, lon: 4.99 },
              { lat: 44.99, lon: 4.99 },
            ],
          },
        ],
      },
    ],
  };

  const originalFetch = globalThis.fetch;
  globalThis.fetch = (_url: string | URL | Request, _init?: RequestInit) => {
    return Promise.resolve(
      new Response(JSON.stringify(overpassResponse), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );
  };

  try {
    const corridor = await fetchTrackCorridor(coordinates);
    expect(corridor.waterPolygons.length).toEqual(1);
    expect(corridor.waterPolygons[0].tags.natural).toEqual("water");
  } finally {
    globalThis.fetch = originalFetch;
  }
});
