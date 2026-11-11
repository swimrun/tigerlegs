import { assertEquals } from "@std/assert";
import fc from "fast-check";
import { buildTableRows } from "../../src/client/table-renderer.ts";
import { calculateTotals } from "../../src/client/segment-builder.ts";
import type { Segment, SegmentType } from "../../src/shared/types.ts";

function segment(
  number: number,
  type: SegmentType,
  distanceKm: number,
): Segment {
  return {
    number,
    type,
    distanceKm,
    startTrackpointIndex: number * 10,
    endTrackpointIndex: number * 10 + 9,
    detectedBy: ["speed"],
    confidenceScore: 0.6,
    gpsFiltered: false,
  };
}

Deno.test("table pairs runs with swims, with explicit absence at either edge", () => {
  const segments = [
    segment(1, "swim", 0.387),
    segment(2, "run", 5.23),
    segment(3, "swim", 1.125),
    segment(4, "run", 1.37),
  ];
  const rows = buildTableRows(segments, {
    swimFirst: false,
    showCumulative: true,
  });
  assertEquals(
    rows.map((row) => [row.pair.runDistanceKm, row.pair.swimDistanceM]),
    [
      ["—", "400"],
      ["5.2", "1150"],
      ["1.4", "—"],
    ],
  );
  assertEquals(rows.map((row) => row.cumulativeKm), ["0.4", "6.7", "8.1"]);
  assertEquals(rows.map((row) => row.segments.map((s) => s.number)), [[1], [
    2,
    3,
  ], [4]]);
  assertEquals(calculateTotals(segments), {
    totalRunKm: "6.6",
    totalSwimM: "1500",
  });
  const swimFirst = buildTableRows(segments, {
    swimFirst: true,
    showCumulative: false,
  });
  assertEquals(swimFirst.map((row) => row.segments.map((s) => s.number)), [[
    1,
    2,
  ], [3, 4]]);
});

Deno.test("breaks never become run/swim distances or pair across a displayed break", () => {
  const segments = [
    segment(1, "run", 1),
    segment(2, "unclassified", 0.2),
    segment(3, "swim", 0.5),
  ];
  const rows = buildTableRows(segments, {
    swimFirst: false,
    showCumulative: true,
  });
  assertEquals(rows.length, 3);
  assertEquals([rows[1].pair.runDistanceKm, rows[1].pair.swimDistanceM], [
    "—",
    "—",
  ]);
  assertEquals(rows[2].cumulativeKm, "1.7");
});

Deno.test("table assigns boundary conflicts and per-pair detection labels", () => {
  const segments = [segment(1, "run", 1), segment(2, "swim", 0.4)];
  segments[1].detectedBy = ["landscape"];
  const conflict = {
    trackpointIndex: 20,
    strategies: ["speed", "landscape"] as const,
    resolvedBy: "landscape" as const,
  };
  const rows = buildTableRows(segments, {
    swimFirst: false,
    showCumulative: false,
  }, [
    { ...conflict, strategies: [...conflict.strategies] },
  ]);
  assertEquals(rows[0].pair.detectedBy, "speed + landscape");
  assertEquals(rows[0].conflicts.length, 1);
  assertEquals(
    buildTableRows([], { swimFirst: false, showCumulative: false }),
    [],
  );
});

Deno.test("property: pairing preserves every segment, distance and selection identity", () => {
  fc.assert(
    fc.property(
      fc.array(
        fc.record({
          type: fc.constantFrom<SegmentType>("swim", "run", "unclassified"),
          distance: fc.integer({ min: 0, max: 10000 }),
        }),
        { maxLength: 100 },
      ),
      fc.boolean(),
      (items, swimFirst) => {
        const segments = items.map((item, i) =>
          segment(i + 1, item.type, item.distance / 1000)
        );
        const rows = buildTableRows(segments, {
          swimFirst,
          showCumulative: true,
        });
        assertEquals(rows.flatMap((row) => row.segments), segments);
        for (const row of rows) {
          assertEquals(row.segments.length <= 2, true);
          if (row.segments.length === 2) {
            assertEquals(
              row.segments.map((s) => s.type),
              swimFirst ? ["swim", "run"] : ["run", "swim"],
            );
          }
          assertEquals(
            row.pair.runDistanceKm.length > 0 &&
              row.pair.swimDistanceM.length > 0,
            true,
          );
        }
        // The expectation is computed in whole metres, so it does not depend on the order of float additions.
        const totalMetres = items.reduce((sum, item) => sum + item.distance, 0);
        assertEquals(
          rows.at(-1)?.cumulativeKm ?? "0.0",
          (Math.round(totalMetres / 100) / 10).toFixed(1),
        );
      },
    ),
    { numRuns: 300 },
  );
});

Deno.test("cumulative km rounds an exact tie up, whatever the order of the additions (issue #66)", () => {
  // 30.325 km + 30.325 km = 60.650 km; as a float it is just below 60.65, and toFixed(1) gave 60.6.
  const rows = buildTableRows(
    [segment(1, "run", 30.325), segment(2, "run", 30.325)],
    { swimFirst: false, showCumulative: true },
  );
  assertEquals(rows.at(-1)?.cumulativeKm, "60.7");
});
