import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { resolve, extname } from "node:path";

const root = resolve("dist");
const types = { ".html": "text/html", ".js": "application/javascript", ".css": "text/css", ".json": "application/json", ".webmanifest": "application/manifest+json", ".svg": "image/svg+xml", ".png": "image/png", ".jpg": "image/jpeg", ".woff2": "font/woff2", ".gpx": "application/gpx+xml" };
createServer(async (request, response) => {
  const path = decodeURIComponent(new URL(request.url, "http://localhost").pathname);
  if (!path.startsWith("/tigerlegs/")) { response.writeHead(404).end(); return; }
  const file = resolve(root, path.slice("/tigerlegs/".length) || "index.html");
  if (!file.startsWith(root + "/")) { response.writeHead(403).end(); return; }
  try {
    const body = await readFile(file);
    response.writeHead(200, { "content-type": types[extname(file)] ?? "application/octet-stream" }).end(body);
  } catch (error) {
    if (error.code === "ENOENT") response.writeHead(404).end();
    else { console.error(error); response.writeHead(500).end(); }
  }
}).listen(8784, "127.0.0.1");
