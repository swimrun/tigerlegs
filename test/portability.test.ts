import { assert } from "@std/assert";

/**
 * Architecture rule (ADR-0014): the modules listed in tsconfig.shared.json are shared with a possible
 * Node.js back end, so they must not depend on Deno or on the browser. `npm run check:shared` enforces it
 * at compile time (no Deno namespace, no DOM, erasable syntax only); this test proves that Node itself
 * can load each of them with its built-in type stripping.
 */
const config = JSON.parse(Deno.readTextFileSync("tsconfig.shared.json")) as { include: string[] };

for (const file of config.include) {
  Deno.test(`${file} loads under Node.js`, async () => {
    const { code, stderr } = await new Deno.Command("node", {
      args: ["--input-type=module", "-e", `await import("./${file}")`],
    }).output();
    assert(code === 0, new TextDecoder().decode(stderr));
  });
}
