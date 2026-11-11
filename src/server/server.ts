import { createServer, type IncomingMessage, type Server, type ServerResponse } from "node:http";
import { Readable } from "node:stream";
import { createRouter, type RouterConfig } from "./router.ts";
import { createCacheStore } from "./cache.ts";
import { BACKEND_PORT, FRONTEND_ORIGIN } from "./config.ts";

// --- Types ---

export interface ServerConfig {
  port: number;
  allowedOrigins: string[];
  staticDir: string;
  cacheDir: string;
}

// --- Node.js to Web Request/Response ---

/** The router speaks the Web `Request` and `Response`; this turns a Node request into one. */
export function toRequest(incoming: IncomingMessage, origin: string): Request {
  const headers = new Headers();
  for (const [name, value] of Object.entries(incoming.headers)) {
    if (Array.isArray(value)) value.forEach((item) => headers.append(name, item));
    else if (value !== undefined) headers.set(name, value);
  }
  const method = incoming.method ?? "GET";
  const hasBody = method !== "GET" && method !== "HEAD";
  return new Request(new URL(incoming.url ?? "/", origin), {
    method,
    headers,
    ...(hasBody ? { body: Readable.toWeb(incoming) as ReadableStream, duplex: "half" } : {}),
  } as RequestInit);
}

/** Writes a Web `Response` to a Node response. */
export async function sendResponse(response: Response, outgoing: ServerResponse): Promise<void> {
  outgoing.writeHead(response.status, Object.fromEntries(response.headers));
  outgoing.end(Buffer.from(await response.arrayBuffer()));
}

// --- Server ---

/**
 * Start the HTTP server on Node.js.
 * Serves the REST API endpoints and, in development, static files.
 */
export function startServer(config: ServerConfig): Server {
  const { port, allowedOrigins, staticDir, cacheDir } = config;

  const cacheStore = createCacheStore("filesystem", cacheDir);

  const routerConfig: RouterConfig = {
    allowedOrigins,
    cacheStore,
    staticDir,
  };

  const handler = createRouter(routerConfig);

  console.log(`[server] Starting on port ${port}`);
  console.log(`[server] Allowed origins: ${allowedOrigins.join(", ")}`);
  console.log(`[server] Static dir: ${staticDir}`);
  console.log(`[server] Cache dir: ${cacheDir}`);

  const server = createServer((incoming, outgoing) => {
    handler(toRequest(incoming, `http://${incoming.headers.host ?? `localhost:${port}`}`))
      .then((response) => sendResponse(response, outgoing))
      .catch((error: unknown) => {
        console.error("[server] Unhandled error", error);
        if (!outgoing.headersSent) outgoing.writeHead(500, { "Content-Type": "application/json" });
        outgoing.end(JSON.stringify({ error: "Internal server error", code: "INTERNAL_ERROR" }));
      });
  });
  server.listen(port);
  return server;
}

// --- Main entry point ---

/**
 * Read configuration from environment variables and start the server.
 */
function main(): void {
  const port = Number(process.env.PORT ?? BACKEND_PORT);
  const allowedOrigins = (process.env.ALLOWED_ORIGINS ?? FRONTEND_ORIGIN)
    .split(",")
    .map((o) => o.trim());
  const staticDir = process.env.STATIC_DIR ?? "./public";
  const cacheDir = process.env.CACHE_PATH ?? "./data/terrain_cache";

  startServer({ port, allowedOrigins, staticDir, cacheDir });
}

// Run if executed directly
if (import.meta.main) {
  main();
}
