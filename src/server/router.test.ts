import { expect, it } from "vitest";
import { BACKEND_ORIGIN, FRONTEND_ORIGIN } from "./config.ts";
import { createRouter, type RouterConfig } from "./router.ts";
import type { CacheStore } from "./cache.ts";
import type { TerrainResult } from "../shared/types.ts";

/** Minimal mock CacheStore for testing */
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

function createTestRouter(overrides?: Partial<RouterConfig>) {
  const config: RouterConfig = {
    allowedOrigins: [FRONTEND_ORIGIN, "https://swimrun.group"],
    cacheStore: createMockCacheStore(),
    ...overrides,
  };
  return createRouter(config);
}

// --- Health endpoint ---

it("GET /api/v1/health returns status ok", async () => {
  const handler = createTestRouter();
  const request = new Request(`${BACKEND_ORIGIN}/api/v1/health`);
  const response = await handler(request);

  expect(response.status).toEqual(200);
  const body = await response.json();
  expect(body.status).toEqual("ok");
});

it("GET /api/v1/health does not require Origin header", async () => {
  const handler = createTestRouter();
  const request = new Request(`${BACKEND_ORIGIN}/api/v1/health`);
  const response = await handler(request);

  expect(response.status).toEqual(200);
});

it("Responses include X-Request-Id header", async () => {
  const handler = createTestRouter();
  const request = new Request(`${BACKEND_ORIGIN}/api/v1/health`);
  const response = await handler(request);

  const requestId = response.headers.get("X-Request-Id");
  expect(typeof requestId).toEqual("string");
  expect(requestId!.length > 0).toEqual(true);
});

it("Responses include Content-Type: application/json", async () => {
  const handler = createTestRouter();
  const request = new Request(`${BACKEND_ORIGIN}/api/v1/health`);
  const response = await handler(request);

  expect(response.headers.get("Content-Type")).toEqual("application/json");
});

// --- Origin validation ---

it("Non-health endpoints reject requests without valid Origin", async () => {
  const handler = createTestRouter();
  const request = new Request(`${BACKEND_ORIGIN}/api/v1/terrain/lookup?lat=45&lon=6`, {
    headers: { Origin: "http://evil.example.com" },
  });
  const response = await handler(request);

  expect(response.status).toEqual(403);
  const body = await response.json();
  expect(body.code).toEqual("FORBIDDEN_ORIGIN");
});

it("Non-health endpoints accept requests from allowed origins", async () => {
    const handler = createTestRouter();
    const request = new Request(`${BACKEND_ORIGIN}/api/v1/terrain/lookup?lat=45&lon=6`, {
      headers: { Origin: FRONTEND_ORIGIN },
    });
    const response = await handler(request);

    // Should not be 403; the request reaches the handler (may get 502 since
    // Overpass isn't available in test, but that proves origin check passed)
    expect(response.status !== 403).toEqual(true);
    await response.text(); // consume body
  });

// --- CORS headers ---

it("CORS headers are set for allowed origin", async () => {
  const handler = createTestRouter();
  const request = new Request(`${BACKEND_ORIGIN}/api/v1/health`, {
    headers: { Origin: FRONTEND_ORIGIN },
  });
  const response = await handler(request);

  expect(response.headers.get("Access-Control-Allow-Origin")).toEqual(FRONTEND_ORIGIN);
});

it("OPTIONS preflight returns CORS headers", async () => {
  const handler = createTestRouter();
  const request = new Request(`${BACKEND_ORIGIN}/api/v1/terrain/lookup`, {
    method: "OPTIONS",
    headers: {
      Origin: FRONTEND_ORIGIN,
      "Access-Control-Request-Method": "GET",
    },
  });
  const response = await handler(request);

  expect(response.status).toEqual(204);
  expect(response.headers.get("Access-Control-Allow-Origin")).toEqual(FRONTEND_ORIGIN);
  expect(response.headers.get("Access-Control-Allow-Methods") ?? "").toContain("GET");
});

// --- Coordinate validation ---

it("GET /api/v1/terrain/lookup rejects invalid latitude", async () => {
  const handler = createTestRouter();
  const request = new Request(`${BACKEND_ORIGIN}/api/v1/terrain/lookup?lat=91&lon=6`, {
    headers: { Origin: FRONTEND_ORIGIN },
  });
  const response = await handler(request);

  expect(response.status).toEqual(400);
  const body = await response.json();
  expect(body.code).toEqual("INVALID_COORDINATES");
});

it("GET /api/v1/terrain/lookup rejects invalid longitude", async () => {
  const handler = createTestRouter();
  const request = new Request(`${BACKEND_ORIGIN}/api/v1/terrain/lookup?lat=45&lon=181`, {
    headers: { Origin: FRONTEND_ORIGIN },
  });
  const response = await handler(request);

  expect(response.status).toEqual(400);
  const body = await response.json();
  expect(body.code).toEqual("INVALID_COORDINATES");
});

it("GET /api/v1/terrain/lookup rejects missing parameters", async () => {
  const handler = createTestRouter();
  const request = new Request(`${BACKEND_ORIGIN}/api/v1/terrain/lookup?lat=45`, {
    headers: { Origin: FRONTEND_ORIGIN },
  });
  const response = await handler(request);

  expect(response.status).toEqual(400);
  const body = await response.json();
  expect(body.code).toEqual("INVALID_COORDINATES");
});

// --- Batch endpoint validation ---

it("POST /api/v1/terrain/batch rejects more than 100 coordinates", async () => {
  const handler = createTestRouter();
  const coordinates = Array.from({ length: 101 }, (_, i) => ({
    lat: 45 + i * 0.001,
    lon: 6 + i * 0.001,
  }));
  const request = new Request(`${BACKEND_ORIGIN}/api/v1/terrain/batch`, {
    method: "POST",
    headers: {
      Origin: FRONTEND_ORIGIN,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ coordinates }),
  });
  const response = await handler(request);

  expect(response.status).toEqual(400);
  const body = await response.json();
  expect(body.code).toEqual("BATCH_TOO_LARGE");
});

it("POST /api/v1/terrain/batch rejects invalid coordinates in batch", async () => {
  const handler = createTestRouter();
  const coordinates = [
    { lat: 45, lon: 6 },
    { lat: -91, lon: 6 }, // invalid
  ];
  const request = new Request(`${BACKEND_ORIGIN}/api/v1/terrain/batch`, {
    method: "POST",
    headers: {
      Origin: FRONTEND_ORIGIN,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ coordinates }),
  });
  const response = await handler(request);

  expect(response.status).toEqual(400);
  const body = await response.json();
  expect(body.code).toEqual("INVALID_COORDINATES");
});

// --- 404 for unknown routes ---

it("Unknown routes return 404", async () => {
  const handler = createTestRouter();
  const request = new Request(`${BACKEND_ORIGIN}/api/v1/unknown`, {
    headers: { Origin: FRONTEND_ORIGIN },
  });
  const response = await handler(request);

  expect(response.status).toEqual(404);
  const body = await response.json();
  expect(body.code).toEqual("NOT_FOUND");
});
