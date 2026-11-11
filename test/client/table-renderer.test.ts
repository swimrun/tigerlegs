import { expect, it } from "vitest";
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

it("table pairs runs with swims, with explicit absence at either edge", () => {
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
  expect(rows.map((row) => [row.pair.runDistanceKm, row.pair.swimDistanceM])).toEqual([
      ["—", "400"],
      ["5.2", "1150"],
      ["1.4", "—"],
    ]);
  expect(rows.map((row) => row.cumulativeKm)).toEqual(["0.4", "6.7", "8.1"]);
  expect(rows.map((row) => row.segments.map((s) => s.number))).toEqual([[1], [
    2,
    3,
  ], [4]]);
  expect(calculateTotals(segments)).toEqual({
    totalRunKm: "6.6",
    totalSwimM: "1500",
  });
  const swimFirst = buildTableRows(segments, {
    swimFirst: true,
    showCumulative: false,
  });
  expect(swimFirst.map((row) => row.segments.map((s) => s.number))).toEqual([[
    1,
    2,
  ], [3, 4]]);
});

it("breaks never become run/swim distances or pair across a displayed break", () => {
  const segments = [
    segment(1, "run", 1),
    segment(2, "unclassified", 0.2),
    segment(3, "swim", 0.5),
  ];
  const rows = buildTableRows(segments, {
    swimFirst: false,
    showCumulative: true,
  });
  expect(rows.length).toEqual(3);
  expect([rows[1].pair.runDistanceKm, rows[1].pair.swimDistanceM]).toEqual([
    "—",
    "—",
  ]);
  expect(rows[2].cumulativeKm).toEqual("1.7");
});

it("table assigns boundary conflicts and per-pair detection labels", () => {
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
  expect(rows[0].pair.detectedBy).toEqual("speed + landscape");
  expect(rows[0].conflicts.length).toEqual(1);
  expect(buildTableRows([], { swimFirst: false, showCumulative: false })).toEqual([]);
});

it("property: pairing preserves every segment, distance and selection identity", () => {
  fc.assert(fc.property(
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
        expect(rows.flatMap((row) => row.segments)).toEqual(segments);
        for (const row of rows) {
          expect(row.segments.length <= 2).toEqual(true);
          if (row.segments.length === 2) {
            expect(row.segments.map((s) => s.type)).toEqual(swimFirst ? ["swim", "run"] : ["run", "swim"]);
          }
          expect(row.pair.runDistanceKm.length > 0 &&
              row.pair.swimDistanceM.length > 0).toEqual(true);
        }
        // The expectation is computed in whole metres, so it does not depend on the order of float additions.
        const totalMetres = items.reduce((sum, item) => sum + item.distance, 0);
        expect(rows.at(-1)?.cumulativeKm ?? "0.0").toEqual((Math.round(totalMetres / 100) / 10).toFixed(1));
      },
    ), { numRuns: 300 });
});

it("cumulative km rounds an exact tie up, whatever the order of the additions (issue #66)", () => {
  // 30.325 km + 30.325 km = 60.650 km; as a float it is just below 60.65, and toFixed(1) gave 60.6.
  const rows = buildTableRows(
    [segment(1, "run", 30.325), segment(2, "run", 30.325)],
    { swimFirst: false, showCumulative: true },
  );
  expect(rows.at(-1)?.cumulativeKm).toEqual("60.7");
});
