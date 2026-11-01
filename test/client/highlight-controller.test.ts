import { assertEquals, assertThrows } from "@std/assert";
import fc from "fast-check";
import { createHighlightController } from "../../src/client/highlight-controller.ts";

function setup(numbers: number[]) {
  let active: number | null = null;
  let selected: number | null = null;
  const scrolled: number[] = [];
  const controller = createHighlightController(numbers, {
    render(a, s) {
      active = a;
      selected = s;
    },
    scrollToSegment: (number) => scrolled.push(number),
  });
  return { controller, state: () => ({ active, selected }), scrolled };
}

Deno.test("Property 11: highlight maintains single selection with toggle", () => {
  fc.assert(
    fc.property(
      fc.array(fc.integer({ min: 1, max: 30 }), { maxLength: 200 }),
      (selections) => {
        const { controller, state } = setup(
          Array.from({ length: 30 }, (_, i) => i + 1),
        );
        let expected: number | null = null;
        for (const number of selections) {
          controller.selectSegment(number);
          expected = expected === number ? null : number;
          assertEquals(controller.getSelected(), expected);
          assertEquals(state(), { active: expected, selected: expected });
        }
      },
    ),
    { numRuns: 300 },
  );
});

Deno.test("hover previews do not replace a pinned selection or prevent deselection", () => {
  const { controller, state } = setup([2, 5]);
  controller.previewSegment(2);
  assertEquals(state(), { active: 2, selected: null });
  controller.selectSegment(2);
  controller.previewSegment(5);
  assertEquals(state(), { active: 2, selected: 2 });
  controller.selectSegment(2);
  assertEquals(state(), { active: null, selected: null });
  controller.previewSegment(5);
  controller.previewSegment(null);
  assertEquals(state(), { active: null, selected: null });
});

Deno.test("map selection scrolls to its row; table selection and toggle-off do not", () => {
  const { controller, scrolled } = setup([1, 2]);
  controller.selectSegment(1, "map");
  controller.selectSegment(1, "map");
  controller.selectSegment(2, "table");
  assertEquals(scrolled, [1]);
});

Deno.test("clear and destroy reset both views; stale events cannot restore selection", () => {
  const { controller, state } = setup([1]);
  controller.selectSegment(1);
  controller.clearSelection();
  assertEquals(state(), { active: null, selected: null });
  controller.selectSegment(1);
  controller.destroy();
  controller.selectSegment(1);
  controller.previewSegment(1);
  assertEquals(state(), { active: null, selected: null });
  assertEquals(controller.getSelected(), null);
});

Deno.test("unknown segments report a programming error without changing selection", () => {
  const { controller } = setup([1]);
  controller.selectSegment(1);
  assertThrows(() => controller.selectSegment(99), RangeError);
  assertThrows(() => controller.previewSegment(99), RangeError);
  assertEquals(controller.getSelected(), 1);
});
