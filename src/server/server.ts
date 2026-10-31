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

// --- Server ---

/**
 * Start the Deno HTTP server.
 * Serves REST API endpoints and static files.
 * Uses Deno.serve() (standard Deno API).
 */
export function startServer(config: ServerConfig): void {
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

  Deno.serve({ port }, handler);
}

// --- Main entry point ---

/**
 * Read configuration from environment variables and start the server.
 */
function main(): void {
  const port = Number(Deno.env.get("PORT") ?? BACKEND_PORT);
  const allowedOrigins = (Deno.env.get("ALLOWED_ORIGINS") ?? FRONTEND_ORIGIN)
    .split(",")
    .map((o) => o.trim());
  const staticDir = Deno.env.get("STATIC_DIR") ?? "./public";
  const cacheDir = Deno.env.get("CACHE_PATH") ?? "./data/terrain_cache";

  startServer({ port, allowedOrigins, staticDir, cacheDir });
}

// Run if executed directly
if (import.meta.main) {
  main();
}
