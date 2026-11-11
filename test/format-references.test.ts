import { assertEquals } from "@std/assert";
import { bulletReferences } from "../src/format-references.ts";

Deno.test("bulletReferences turns blank-line separated sources into one bullet each", () => {
  const input = "## References\n\nBrown, S. (n.d.). *A*. https://a\n\nGarmin. (n.d.). *B*.\nhttps://b\n\n## Appendices\n\ntext";
  assertEquals(
    bulletReferences(input),
    "## References\n\n- Brown, S. (n.d.). *A*. https://a\n- Garmin. (n.d.). *B*.\n  https://b\n\n## Appendices\n\ntext",
  );
});

Deno.test("bulletReferences is idempotent, leaves a list alone and handles the last section of a file", () => {
  const input = "Intro\n\n## References\n\nOne. (n.d.). *X*.\n\nTwo. (n.d.). *Y*.\n";
  const once = bulletReferences(input);
  assertEquals(once, "Intro\n\n## References\n\n- One. (n.d.). *X*.\n- Two. (n.d.). *Y*.\n");
  assertEquals(bulletReferences(once), once);
  const list = "## References\n\n- A\n- B\n";
  assertEquals(bulletReferences(list), list);
});

Deno.test("bulletReferences leaves a document without a References section untouched", () => {
  assertEquals(bulletReferences("# Title\n\ntext\n"), "# Title\n\ntext\n");
});
