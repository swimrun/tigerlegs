import { expect, it } from "vitest";
import { bulletReferences } from "../src/format-references.ts";

it("bulletReferences turns blank-line separated sources into one bullet each", () => {
  const input = "## References\n\nBrown, S. (n.d.). *A*. https://a\n\nGarmin. (n.d.). *B*.\nhttps://b\n\n## Appendices\n\ntext";
  expect(bulletReferences(input)).toEqual("## References\n\n- Brown, S. (n.d.). *A*. https://a\n- Garmin. (n.d.). *B*.\n  https://b\n\n## Appendices\n\ntext");
});

it("bulletReferences is idempotent, leaves a list alone and handles the last section of a file", () => {
  const input = "Intro\n\n## References\n\nOne. (n.d.). *X*.\n\nTwo. (n.d.). *Y*.\n";
  const once = bulletReferences(input);
  expect(once).toEqual("Intro\n\n## References\n\n- One. (n.d.). *X*.\n- Two. (n.d.). *Y*.\n");
  expect(bulletReferences(once)).toEqual(once);
  const list = "## References\n\n- A\n- B\n";
  expect(bulletReferences(list)).toEqual(list);
});

it("bulletReferences leaves a document without a References section untouched", () => {
  expect(bulletReferences("# Title\n\ntext\n")).toEqual("# Title\n\ntext\n");
});
