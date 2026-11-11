// TypeScript on Node.js 24 (type stripping, no build step) with the built-in http module and fetch: no dependencies.
import { createServer } from "node:http";
import { fileURLToPath } from "node:url";

const defaultUrl = process.env.OVERPASS_URL ?? "https://overpass-api.de/api/interpreter";
const retryable = new Set([429, 502, 503, 504]);
const realSleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

/** The Overpass water query with exponential backoff (1 s, 2 s) on a busy server. */
export async function water(
  bbox: string,
  { url = defaultUrl, sleep = realSleep }: { url?: string; sleep?: (ms: number) => Promise<void> } = {},
): Promise<string> {
  const query = `[out:json][timeout:25];(way["natural"="water"](${bbox});relation["natural"="water"](${bbox});way["waterway"="riverbank"](${bbox}););out geom;`;
  let wait = 1000;
  let last = "no Overpass server reachable";
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const response = await fetch(url, {
        method: "POST",
        body: "data=" + encodeURIComponent(query),
        headers: { "content-type": "application/x-www-form-urlencoded" },
        signal: AbortSignal.timeout(20000),
      });
      if (response.ok) return await response.text();
      last = `Overpass returned status ${response.status}`;
      if (!retryable.has(response.status)) break;
    } catch (error) {
      last = error instanceof Error ? error.message : String(error);
    }
    if (attempt < 3) {
      await sleep(wait);
      wait *= 2;
    }
  }
  throw new Error(last);
}

const handler = async (request: import("node:http").IncomingMessage, response: import("node:http").ServerResponse) => {
  const url = new URL(request.url ?? "/", "http://localhost");
  if (url.pathname === "/api/v1/health") {
    response.writeHead(200, { "content-type": "application/json" }).end(JSON.stringify({ status: "ok" }));
  } else if (url.pathname === "/api/v1/water") {
    const bbox = url.searchParams.get("bbox");
    if (!bbox) return void response.writeHead(400).end();
    try {
      response.writeHead(200, { "content-type": "application/json" }).end(await water(bbox));
    } catch (error) {
      response.writeHead(502).end(String(error));
    }
  } else {
    response.writeHead(404).end();
  }
};

// Start the server only when this file is run, not when the tests import it.
if (process.argv[1] === fileURLToPath(import.meta.url)) createServer(handler).listen(8080);
