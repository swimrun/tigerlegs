import { expect, it } from "vitest";
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";

/**
 * Architecture rule (ADR-0014): the modules listed in tsconfig.shared.json are shared with a possible
 * Node.js back end, so they must not depend on Deno or on the browser. `npm run check:shared` enforces it
 * at compile time (no Deno namespace, no DOM, erasable syntax only); this test proves that Node itself
 * can load each of them with its built-in type stripping.
 */
const config = JSON.parse(readFileSync("tsconfig.shared.json", "utf8")) as { include: string[] };

for (const file of config.include) {
  it(`${file} loads under Node.js`, () => {
    const { status, stderr } = spawnSync("node", ["--input-type=module", "-e", `await import("./${file}")`], { encoding: "utf8" });
    expect(status === 0, stderr).toBeTruthy();
  });
}
