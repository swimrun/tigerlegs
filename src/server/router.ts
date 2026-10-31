import type { CacheStore } from "./cache.ts";
import type { Coordinate } from "../shared/types.ts";
import { lookupTerrain } from "./terrain-proxy-service.ts";

// --- Types ---

export interface RouterConfig {
  allowedOrigins: string[];
  cacheStore: CacheStore;
  staticDir?: string;
}

interface ErrorResponse {
  error: string;
  code: string;
}

// --- Constants ---

const MAX_BATCH_SIZE = 100;
const CORS_METHODS = "GET, POST, OPTIONS";
const CORS_HEADERS = "Content-Type, Authorization, X-Request-Id";

// --- Helpers ---

function generateRequestId(): string {
  return crypto.randomUUID();
}

function jsonResponse(
  body: unknown,
  status: number,
  headers: Record<string, string> = {},
): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json",
      ...headers,
    },
  });
}

function errorResponse(
  error: string,
  code: string,
  status: number,
  headers: Record<string, string> = {},
): Response {
  const body: ErrorResponse = { error, code };
  return jsonResponse(body, status, headers);
}

function isValidCoordinate(lat: number, lon: number): boolean {
  return (
    Number.isFinite(lat) &&
    Number.isFinite(lon) &&
    lat >= -90 &&
    lat <= 90 &&
    lon >= -180 &&
    lon <= 180
  );
}

function isAllowedOrigin(origin: string | null, allowedOrigins: string[]): boolean {
  if (!origin) return false;
  return allowedOrigins.includes(origin);
}

function getCorsHeaders(
  origin: string | null,
  allowedOrigins: string[],
): Record<string, string> {
  const headers: Record<string, string> = {};
  if (origin && isAllowedOrigin(origin, allowedOrigins)) {
    headers["Access-Control-Allow-Origin"] = origin;
    headers["Access-Control-Allow-Methods"] = CORS_METHODS;
    headers["Access-Control-Allow-Headers"] = CORS_HEADERS;
  }
  return headers;
}

function logRequest(target: string, status: number): void {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] target=${target} status=${status}`);
}

// --- Static file serving ---

async function serveStaticFile(
  filePath: string,
): Promise<Response | null> {
  try {
    const stat = await Deno.stat(filePath);
    if (!stat.isFile) return null;

    const content = await Deno.readFile(filePath);
    const contentType = getContentType(filePath);
    return new Response(content, {
      status: 200,
      headers: { "Content-Type": contentType },
    });
  } catch {
    return null;
  }
}

function getContentType(path: string): string {
  const ext = path.split(".").pop()?.toLowerCase();
  const types: Record<string, string> = {
    html: "text/html; charset=utf-8",
    css: "text/css; charset=utf-8",
    js: "application/javascript; charset=utf-8",
    json: "application/json",
    png: "image/png",
    jpg: "image/jpeg",
    jpeg: "image/jpeg",
    svg: "image/svg+xml",
    ico: "image/x-icon",
    woff2: "font/woff2",
    woff: "font/woff",
  };
  return types[ext ?? ""] ?? "application/octet-stream";
}

// --- Route handlers ---

function handleHealth(): Response {
  return jsonResponse({ status: "ok" }, 200);
}

async function handleTerrainLookup(
  url: URL,
  cacheStore: CacheStore,
): Promise<Response> {
  const latStr = url.searchParams.get("lat");
  const lonStr = url.searchParams.get("lon");

  if (!latStr || !lonStr) {
    return errorResponse(
      "Missing required parameters: lat and lon",
      "INVALID_COORDINATES",
      400,
    );
  }

  const lat = Number(latStr);
  const lon = Number(lonStr);

  if (!isValidCoordinate(lat, lon)) {
    return errorResponse(
      "Coordinates out of valid range: lat must be -90..90, lon must be -180..180",
      "INVALID_COORDINATES",
      400,
    );
  }

  try {
    const results = await lookupTerrain([{ lat, lon }], cacheStore);
    logRequest("terrain", 200);
    return jsonResponse(results[0], 200);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Internal server error";
    logRequest("terrain", 502);
    return errorResponse(message, "UPSTREAM_ERROR", 502);
  }
}

async function handleTerrainBatch(
  request: Request,
  cacheStore: CacheStore,
): Promise<Response> {
  let body: { coordinates?: unknown };
  try {
    body = await request.json();
  } catch {
    return errorResponse(
      "Invalid JSON body",
      "INVALID_REQUEST_BODY",
      400,
    );
  }

  if (!body.coordinates || !Array.isArray(body.coordinates)) {
    return errorResponse(
      "Missing or invalid 'coordinates' array in request body",
      "INVALID_REQUEST_BODY",
      400,
    );
  }

  const coordinates = body.coordinates as Array<{ lat?: number; lon?: number }>;

  if (coordinates.length > MAX_BATCH_SIZE) {
    return errorResponse(
      `Batch size exceeds maximum of ${MAX_BATCH_SIZE} coordinates`,
      "BATCH_TOO_LARGE",
      400,
    );
  }

  // Validate all coordinates
  for (let i = 0; i < coordinates.length; i++) {
    const coord = coordinates[i];
    if (
      coord.lat === undefined ||
      coord.lon === undefined ||
      !isValidCoordinate(coord.lat, coord.lon)
    ) {
      return errorResponse(
        `Invalid coordinate at index ${i}: lat must be -90..90, lon must be -180..180`,
        "INVALID_COORDINATES",
        400,
      );
    }
  }

  try {
    const validCoordinates: Coordinate[] = coordinates.map((c) => ({
      lat: c.lat!,
      lon: c.lon!,
    }));
    const results = await lookupTerrain(validCoordinates, cacheStore);
    logRequest("terrain", 200);
    return jsonResponse({ results }, 200);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Internal server error";
    logRequest("terrain", 502);
    return errorResponse(message, "UPSTREAM_ERROR", 502);
  }
}

// --- Router factory ---

/**
 * Create a request handler function that routes requests to the
 * appropriate handler based on the URL path and method.
 */
export function createRouter(
  config: RouterConfig,
): (request: Request) => Promise<Response> {
  const { allowedOrigins, cacheStore, staticDir } = config;

  return async (request: Request): Promise<Response> => {
    const url = new URL(request.url);
    const path = url.pathname;
    const method = request.method.toUpperCase();
    const origin = request.headers.get("Origin");
    const requestId = generateRequestId();

    // Common response headers
    const corsHeaders = getCorsHeaders(origin, allowedOrigins);
    const commonHeaders: Record<string, string> = {
      "X-Request-Id": requestId,
      ...corsHeaders,
    };

    // Handle CORS preflight
    if (method === "OPTIONS") {
      return new Response(null, {
        status: 204,
        headers: commonHeaders,
      });
    }

    // Route: health check (no origin validation required)
    if (path === "/api/v1/health" && method === "GET") {
      const response = handleHealth();
      return addHeaders(response, commonHeaders);
    }

    // For non-health API endpoints, validate origin
    if (path.startsWith("/api/")) {
      if (!isAllowedOrigin(origin, allowedOrigins)) {
        const response = errorResponse(
          "Request origin not allowed",
          "FORBIDDEN_ORIGIN",
          403,
        );
        return addHeaders(response, commonHeaders);
      }
    }

    // Route: terrain lookup
    if (path === "/api/v1/terrain/lookup" && method === "GET") {
      const response = await handleTerrainLookup(url, cacheStore);
      return addHeaders(response, commonHeaders);
    }

    // Route: terrain batch
    if (path === "/api/v1/terrain/batch" && method === "POST") {
      const response = await handleTerrainBatch(request, cacheStore);
      return addHeaders(response, commonHeaders);
    }

    // Static file serving (dev mode)
    if (staticDir && !path.startsWith("/api/")) {
      const filePath = `${staticDir}${path === "/" ? "/index.html" : path}`;
      const staticResponse = await serveStaticFile(filePath);
      if (staticResponse) {
        // Add request-id but not JSON content-type for static files
        staticResponse.headers.set("X-Request-Id", requestId);
        return staticResponse;
      }
    }

    // 404 for unknown routes
    const response = errorResponse("Not found", "NOT_FOUND", 404);
    return addHeaders(response, commonHeaders);
  };
}

/**
 * Clone a response with additional headers merged in.
 */
function addHeaders(
  response: Response,
  headers: Record<string, string>,
): Response {
  const newHeaders = new Headers(response.headers);
  for (const [key, value] of Object.entries(headers)) {
    newHeaders.set(key, value);
  }
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers: newHeaders,
  });
}
