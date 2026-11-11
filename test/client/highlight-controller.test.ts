import { expect, it } from "vitest";
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

it("Property 11: highlight maintains single selection with toggle", () => {
  fc.assert(fc.property(
      fc.array(fc.integer({ min: 1, max: 30 }), { maxLength: 200 }),
      (selections) => {
        const { controller, state } = setup(
          Array.from({ length: 30 }, (_, i) => i + 1),
        );
        let expected: number | null = null;
        for (const number of selections) {
          controller.selectSegment(number);
          expected = expected === number ? null : number;
          expect(controller.getSelected()).toEqual(expected);
          expect(state()).toEqual({ active: expected, selected: expected });
        }
      },
    ), { numRuns: 300 });
});

it("hover previews do not replace a pinned selection or prevent deselection", () => {
  const { controller, state } = setup([2, 5]);
  controller.previewSegment(2);
  expect(state()).toEqual({ active: 2, selected: null });
  controller.selectSegment(2);
  controller.previewSegment(5);
  expect(state()).toEqual({ active: 2, selected: 2 });
  controller.selectSegment(2);
  expect(state()).toEqual({ active: null, selected: null });
  controller.previewSegment(5);
  controller.previewSegment(null);
  expect(state()).toEqual({ active: null, selected: null });
});

it("map selection scrolls to its row; table selection and toggle-off do not", () => {
  const { controller, scrolled } = setup([1, 2]);
  controller.selectSegment(1, "map");
  controller.selectSegment(1, "map");
  controller.selectSegment(2, "table");
  expect(scrolled).toEqual([1]);
});

it("clear and destroy reset both views; stale events cannot restore selection", () => {
  const { controller, state } = setup([1]);
  controller.selectSegment(1);
  controller.clearSelection();
  expect(state()).toEqual({ active: null, selected: null });
  controller.selectSegment(1);
  controller.destroy();
  controller.selectSegment(1);
  controller.previewSegment(1);
  expect(state()).toEqual({ active: null, selected: null });
  expect(controller.getSelected()).toEqual(null);
});

it("unknown segments report a programming error without changing selection", () => {
  const { controller } = setup([1]);
  controller.selectSegment(1);
  expect(() => controller.selectSegment(99)).toThrow(RangeError);
  expect(() => controller.previewSegment(99)).toThrow(RangeError);
  expect(controller.getSelected()).toEqual(1);
});
