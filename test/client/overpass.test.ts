import { assert, assertEquals, assertRejects } from "@std/assert";
import { queryOverpass } from "../../src/client/overpass.ts";
import { browserOverpassCache, CACHE_MAX_AGE_MS } from "../../src/client/overpass-cache.ts";
import { fetchWater } from "../../src/client/water.ts";
import type { Trackpoint } from "../../src/shared/types.ts";

const ok = (body: unknown) => new Response(JSON.stringify(body), { status: 200 });
const status = (code: number, headers: Record<string, string> = {}) => new Response("busy", { status: code, headers });

/** Answers from a list, one per call, and records the URLs it was asked. */
function scripted(answers: (Response | Error)[]) {
  const urls: string[] = [];
  const fetcher = ((url: string) => {
    urls.push(url);
    const next = answers.shift();
    if (!next) throw new Error("unexpected extra request");
    return next instanceof Error ? Promise.reject(next) : Promise.resolve(next);
  }) as unknown as typeof fetch;
  return { fetcher, urls };
}

function sleeper() {
  const waits: number[] = [];
  return { waits, sleep: (ms: number) => (waits.push(ms), Promise.resolve()) };
}

Deno.test("queryOverpass: a busy server is retried with a doubling wait, then it works", async () => {
  const { fetcher, urls } = scripted([status(502), status(504), ok({ elements: [] })]);
  const { sleep, waits } = sleeper();
  assertEquals(await queryOverpass("q", { fetcher, sleep, urls: ["https://a"] }), { elements: [] });
  assertEquals(waits, [1000, 2000]);
  assertEquals(urls, ["https://a", "https://a", "https://a"]);
});

Deno.test("queryOverpass: Retry-After wins over the doubling wait, within a cap", async () => {
  const { fetcher } = scripted([status(429, { "retry-after": "3" }), status(429, { "retry-after": "999" }), ok({})]);
  const { sleep, waits } = sleeper();
  await queryOverpass("q", { fetcher, sleep, urls: ["https://a"] });
  assertEquals(waits, [3000, 10000]);
});

Deno.test("queryOverpass: after three busy answers it moves on to the next mirror", async () => {
  const { fetcher, urls } = scripted([status(503), status(503), status(503), ok({ from: "b" })]);
  const { sleep, waits } = sleeper();
  assertEquals(await queryOverpass("q", { fetcher, sleep, urls: ["https://a", "https://b"] }), { from: "b" });
  assertEquals(urls, ["https://a", "https://a", "https://a", "https://b"]);
  assertEquals(waits, [1000, 2000]);
});

Deno.test("queryOverpass: a bad query is not retried", async () => {
  const { fetcher, urls } = scripted([status(400), ok({ from: "b" })]);
  const { sleep, waits } = sleeper();
  await queryOverpass("q", { fetcher, sleep, urls: ["https://a", "https://b"] });
  assertEquals(urls, ["https://a", "https://b"]);
  assertEquals(waits, []);
});

Deno.test("queryOverpass: network errors are retried and the last error is reported", async () => {
  const { fetcher } = scripted([new Error("offline"), new Error("offline"), new Error("still offline")]);
  const { sleep } = sleeper();
  await assertRejects(() => queryOverpass("q", { fetcher, sleep, urls: ["https://a"] }), Error, "still offline");
});

Deno.test("queryOverpass: an aborted request stops at once", async () => {
  const { fetcher, urls } = scripted([ok({})]);
  const controller = new AbortController();
  controller.abort(new Error("cancelled"));
  await assertRejects(() => queryOverpass("q", { fetcher, signal: controller.signal, urls: ["https://a"] }), Error, "cancelled");
  assertEquals(urls, []);
});

const points: Trackpoint[] = [
  { coordinate: { lat: 52.24, lon: 4.95 }, elevation: 0, timestamp: null, index: 0 },
  { coordinate: { lat: 52.25, lon: 4.96 }, elevation: 0, timestamp: null, index: 1 },
];

/** A Cache API stand-in, so the tests do not touch the real one. */
function memoryStorage(): CacheStorage {
  const entries = new Map<string, Response>();
  const cache = {
    match: (url: string) => Promise.resolve(entries.get(url)?.clone()),
    put: (url: string, response: Response) => (entries.set(url, response), Promise.resolve()),
    delete: (url: string) => Promise.resolve(entries.delete(url)),
  };
  return { open: () => Promise.resolve(cache) } as unknown as CacheStorage;
}

Deno.test("fetchWater: the second analysis of the same area comes from the cache", async () => {
  const body = {
    elements: [{
      type: "way",
      tags: { natural: "water" },
      geometry: [{ lat: 1, lon: 1 }, { lat: 1, lon: 2 }, { lat: 2, lon: 2 }, { lat: 1, lon: 1 }],
    }],
  };
  const { fetcher, urls } = scripted([ok(body)]);
  const cache = browserOverpassCache(memoryStorage());
  const first = await fetchWater(points, undefined, { fetcher, cache, urls: ["https://a"] });
  const second = await fetchWater(points, undefined, { fetcher, cache, urls: ["https://a"] });
  assertEquals(urls.length, 1);
  assertEquals(second, first);
  assert(first.length === 1);
});

Deno.test("browserOverpassCache: an entry older than a week is dropped", async () => {
  let now = 1_000_000;
  const cache = browserOverpassCache(memoryStorage(), () => now)!;
  await cache.set("k", { a: 1 });
  assertEquals(await cache.get("k"), { a: 1 });
  now += CACHE_MAX_AGE_MS + 1;
  assertEquals(await cache.get("k"), undefined);
});

Deno.test("browserOverpassCache: no Cache API means no cache", () => {
  assertEquals(browserOverpassCache(null), null);
});
