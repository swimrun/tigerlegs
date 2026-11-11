import assert from "node:assert/strict";
import { createServer, type Server } from "node:http";
import { after, test } from "node:test";
import { water } from "./server.ts";

/** The exponential backoff of the Overpass client, against a scripted local server and without real waiting. */
const servers: Server[] = [];
after(() => servers.forEach((server) => server.close()));

async function answering(...statuses: number[]) {
  let calls = 0;
  const server = createServer((_request, response) => {
    const status = statuses[Math.min(calls++, statuses.length - 1)];
    response.writeHead(status).end(status === 200 ? '{"elements":[]}' : "busy");
  });
  servers.push(server);
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const { port } = server.address() as { port: number };
  const waits: number[] = [];
  return { url: `http://127.0.0.1:${port}/`, waits, sleep: async (ms: number) => void waits.push(ms), calls: () => calls };
}

test("a busy server is retried with a doubling wait, then it works", async () => {
  const upstream = await answering(502, 503, 200);
  assert.equal(await water("1,2,3,4", upstream), '{"elements":[]}');
  assert.deepEqual(upstream.waits, [1000, 2000]);
  assert.equal(upstream.calls(), 3);
});

test("three busy answers end in an error", async () => {
  const upstream = await answering(503);
  await assert.rejects(() => water("1,2,3,4", upstream), /status 503/);
  assert.deepEqual(upstream.waits, [1000, 2000]);
  assert.equal(upstream.calls(), 3);
});

test("a bad query is not retried", async () => {
  const upstream = await answering(400);
  await assert.rejects(() => water("1,2,3,4", upstream), /status 400/);
  assert.deepEqual(upstream.waits, []);
  assert.equal(upstream.calls(), 1);
});

test("an answer on the first try needs no waiting", async () => {
  const upstream = await answering(200);
  await water("1,2,3,4", upstream);
  assert.deepEqual(upstream.waits, []);
});
