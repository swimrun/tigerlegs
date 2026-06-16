import { assertEquals, assert } from "@std/assert";
import fc from "fast-check";
import {
  classifyWaypoint,
  classifyWaypoints,
  validateSwimPairing,
} from "../../src/client/waypoint-classifier.ts";
import { arbitraryWaypoint } from "../generators.ts";
import type { ClassifiedWaypoint, Waypoint } from "../../src/shared/types.ts";

// --- Helpers ---

function makeWaypoint(overrides: Partial<Waypoint> = {}): Waypoint {
  return {
    coordinate: { lat: 45.0, lon: 5.0 },
    elevation: 100,
    name: "",
    symbol: "",
    description: "",
    ...overrides,
  };
}

// --- Property 4: Waypoint classification correctness ---
// **Validates: Requirements 2.1, 2.2, 8.1**
//
// Any waypoint with sym "200" or name containing "début swim" always classifies as "swim-start";
// sym "201" or name containing "fin swim" → "swim-end";
// sym "3" or name containing "ravitaillement" → "aid-station";
// otherwise → "other"

Deno.test("Property 4.1: sym '200' always classifies as swim-start regardless of name", () => {
  fc.assert(
    fc.property(
      fc.string({ minLength: 0, maxLength: 100 }),
      (randomName) => {
        const wp = makeWaypoint({ symbol: "200", name: randomName });
        assertEquals(classifyWaypoint(wp), "swim-start");
      },
    ),
    { numRuns: 100 },
  );
});

Deno.test("Property 4.2: name containing 'début swim' always classifies as swim-start regardless of sym", () => {
  fc.assert(
    fc.property(
      fc.string({ minLength: 0, maxLength: 30 }),
      fc.string({ minLength: 0, maxLength: 30 }),
      fc.string({ minLength: 0, maxLength: 10 }),
      (prefix, suffix, sym) => {
        // Exclude sym values that would match other categories first
        fc.pre(!["200", "201", "3", "49"].includes(sym));
        const name = `${prefix}Début SWIM${suffix}`;
        const wp = makeWaypoint({ symbol: sym, name });
        assertEquals(classifyWaypoint(wp), "swim-start");
      },
    ),
    { numRuns: 100 },
  );
});

Deno.test("Property 4.3: sym '201' always classifies as swim-end regardless of name", () => {
  fc.assert(
    fc.property(
      fc.string({ minLength: 0, maxLength: 100 }),
      (randomName) => {
        // Exclude names that would trigger swim-start first (higher priority)
        fc.pre(!randomName.toLowerCase().includes("swim start"));
        fc.pre(!randomName.toLowerCase().includes("swim entry"));
        fc.pre(!randomName.toLowerCase().includes("water entry"));
        fc.pre(!randomName.toLowerCase().includes("début swim"));
        fc.pre(!randomName.toLowerCase().includes("start swim"));
        fc.pre(!randomName.toLowerCase().includes("zwem start"));
        fc.pre(!randomName.toLowerCase().includes("begin zwem"));
        const wp = makeWaypoint({ symbol: "201", name: randomName });
        assertEquals(classifyWaypoint(wp), "swim-end");
      },
    ),
    { numRuns: 100 },
  );
});

Deno.test("Property 4.4: name containing 'fin swim' always classifies as swim-end (when not matching swim-start)", () => {
  fc.assert(
    fc.property(
      fc.string({ minLength: 0, maxLength: 30 }),
      fc.string({ minLength: 0, maxLength: 30 }),
      fc.string({ minLength: 0, maxLength: 10 }),
      (prefix, suffix, sym) => {
        // Exclude sym values that would trigger swim-start
        fc.pre(!["200", "201", "3", "49"].includes(sym));
        // Ensure name doesn't accidentally match swim-start patterns
        fc.pre(!prefix.toLowerCase().includes("swim start"));
        fc.pre(!prefix.toLowerCase().includes("swim entry"));
        fc.pre(!prefix.toLowerCase().includes("water entry"));
        fc.pre(!prefix.toLowerCase().includes("début swim"));
        fc.pre(!prefix.toLowerCase().includes("start swim"));
        fc.pre(!prefix.toLowerCase().includes("zwem start"));
        fc.pre(!prefix.toLowerCase().includes("begin zwem"));
        const name = `${prefix}Fin SWIM${suffix}`;
        // Also check the full name doesn't accidentally match swim-start
        fc.pre(!name.toLowerCase().includes("swim start"));
        fc.pre(!name.toLowerCase().includes("swim entry"));
        fc.pre(!name.toLowerCase().includes("water entry"));
        fc.pre(!name.toLowerCase().includes("start swim"));
        fc.pre(!name.toLowerCase().includes("zwem start"));
        fc.pre(!name.toLowerCase().includes("begin zwem"));
        const wp = makeWaypoint({ symbol: sym, name });
        assertEquals(classifyWaypoint(wp), "swim-end");
      },
    ),
    { numRuns: 100 },
  );
});

Deno.test("Property 4.5: sym '3' always classifies as aid-station (when not matching swim-start or swim-end)", () => {
  fc.assert(
    fc.property(
      fc.string({ minLength: 0, maxLength: 100 }),
      (randomName) => {
        // Exclude names that would trigger higher-priority classifications
        const lower = randomName.toLowerCase();
        fc.pre(!lower.includes("swim start"));
        fc.pre(!lower.includes("swim entry"));
        fc.pre(!lower.includes("water entry"));
        fc.pre(!lower.includes("début swim"));
        fc.pre(!lower.includes("start swim"));
        fc.pre(!lower.includes("zwem start"));
        fc.pre(!lower.includes("begin zwem"));
        fc.pre(!lower.includes("swim end"));
        fc.pre(!lower.includes("swim exit"));
        fc.pre(!lower.includes("water exit"));
        fc.pre(!lower.includes("fin swim"));
        fc.pre(!lower.includes("end swim"));
        fc.pre(!lower.includes("zwem eind"));
        fc.pre(!lower.includes("einde zwem"));
        const wp = makeWaypoint({ symbol: "3", name: randomName });
        assertEquals(classifyWaypoint(wp), "aid-station");
      },
    ),
    { numRuns: 100 },
  );
});

Deno.test("Property 4.6: name containing 'ravitaillement' always classifies as aid-station (when not matching swim patterns)", () => {
  fc.assert(
    fc.property(
      fc.string({ minLength: 0, maxLength: 30 }),
      fc.string({ minLength: 0, maxLength: 30 }),
      fc.string({ minLength: 0, maxLength: 10 }),
      (prefix, suffix, sym) => {
        // Exclude sym values that trigger swim-start/swim-end
        fc.pre(!["200", "201", "3", "49"].includes(sym));
        // Ensure prefix/suffix don't accidentally match swim patterns
        const lower = prefix.toLowerCase() + suffix.toLowerCase();
        fc.pre(!lower.includes("swim start"));
        fc.pre(!lower.includes("swim entry"));
        fc.pre(!lower.includes("water entry"));
        fc.pre(!lower.includes("début swim"));
        fc.pre(!lower.includes("start swim"));
        fc.pre(!lower.includes("zwem start"));
        fc.pre(!lower.includes("begin zwem"));
        fc.pre(!lower.includes("swim end"));
        fc.pre(!lower.includes("swim exit"));
        fc.pre(!lower.includes("water exit"));
        fc.pre(!lower.includes("fin swim"));
        fc.pre(!lower.includes("end swim"));
        fc.pre(!lower.includes("zwem eind"));
        fc.pre(!lower.includes("einde zwem"));
        const name = `${prefix}Ravitaillement${suffix}`;
        const wp = makeWaypoint({ symbol: sym, name });
        assertEquals(classifyWaypoint(wp), "aid-station");
      },
    ),
    { numRuns: 100 },
  );
});

Deno.test("Property 4.7: waypoints with no matching sym or name pattern classify as 'other'", () => {
  fc.assert(
    fc.property(
      arbitraryWaypoint,
      (wp) => {
        // Exclude all known sym values
        fc.pre(!["200", "201", "3", "49"].includes(wp.symbol));
        // Exclude all known name patterns (case-insensitive)
        const lower = wp.name.toLowerCase();
        fc.pre(!lower.includes("swim start"));
        fc.pre(!lower.includes("swim entry"));
        fc.pre(!lower.includes("water entry"));
        fc.pre(!lower.includes("début swim"));
        fc.pre(!lower.includes("start swim"));
        fc.pre(!lower.includes("zwem start"));
        fc.pre(!lower.includes("begin zwem"));
        fc.pre(!lower.includes("swim end"));
        fc.pre(!lower.includes("swim exit"));
        fc.pre(!lower.includes("water exit"));
        fc.pre(!lower.includes("fin swim"));
        fc.pre(!lower.includes("end swim"));
        fc.pre(!lower.includes("zwem eind"));
        fc.pre(!lower.includes("einde zwem"));
        fc.pre(!lower.includes("ravitaillement"));
        fc.pre(!lower.includes("aid station"));
        fc.pre(!lower.includes("feed zone"));
        fc.pre(!lower.includes("energy post"));
        fc.pre(!lower.includes("food"));
        fc.pre(!lower.includes("drink"));
        fc.pre(!lower.includes("verzorging"));
        fc.pre(!lower.includes("voeding"));
        fc.pre(!lower.includes("verpflegung"));
        assertEquals(classifyWaypoint(wp), "other");
      },
    ),
    { numRuns: 200 },
  );
});

// --- Property 6: Unpaired swim-start detection ---
// **Validates: Requirements 2.8**
//
// If swimStarts.length > swimEnds.length, validateSwimPairing returns { valid: false }

Deno.test("Property 6: validateSwimPairing returns invalid when swim-starts outnumber swim-ends", () => {
  fc.assert(
    fc.property(
      // Generate N swim-start waypoints (at least 1)
      fc.integer({ min: 1, max: 20 }),
      // Generate M swim-end waypoints where M < N
      fc.integer({ min: 0, max: 19 }),
      // Generate some aid-station waypoints (noise)
      fc.integer({ min: 0, max: 5 }),
      (startCount, endMaxCandidate, aidCount) => {
        // Ensure endCount is strictly less than startCount
        const endCount = Math.min(endMaxCandidate, startCount - 1);

        const classified: ClassifiedWaypoint[] = [];

        // Add swim-start waypoints
        for (let i = 0; i < startCount; i++) {
          classified.push({
            waypoint: makeWaypoint({ symbol: "200", name: `Start ${i}` }),
            type: "swim-start",
          });
        }

        // Add swim-end waypoints
        for (let i = 0; i < endCount; i++) {
          classified.push({
            waypoint: makeWaypoint({ symbol: "201", name: `End ${i}` }),
            type: "swim-end",
          });
        }

        // Add aid-station waypoints (should not affect pairing validation)
        for (let i = 0; i < aidCount; i++) {
          classified.push({
            waypoint: makeWaypoint({ symbol: "3", name: `Aid ${i}` }),
            type: "aid-station",
          });
        }

        const result = validateSwimPairing(classified);
        assertEquals(result.valid, false);
        assert(
          result.error !== undefined && result.error.length > 0,
          "Error message should be present when validation fails",
        );
      },
    ),
    { numRuns: 100 },
  );
});

Deno.test("Property 6 (inverse): validateSwimPairing returns valid when swim-starts <= swim-ends", () => {
  fc.assert(
    fc.property(
      // Generate N swim-start waypoints
      fc.integer({ min: 0, max: 10 }),
      // Generate extra ends (0 or more beyond N)
      fc.integer({ min: 0, max: 5 }),
      // Generate some aid-station waypoints (noise)
      fc.integer({ min: 0, max: 5 }),
      (startCount, extraEnds, aidCount) => {
        const endCount = startCount + extraEnds;

        const classified: ClassifiedWaypoint[] = [];

        // Add swim-start waypoints
        for (let i = 0; i < startCount; i++) {
          classified.push({
            waypoint: makeWaypoint({ symbol: "200", name: `Start ${i}` }),
            type: "swim-start",
          });
        }

        // Add swim-end waypoints (equal or more than starts)
        for (let i = 0; i < endCount; i++) {
          classified.push({
            waypoint: makeWaypoint({ symbol: "201", name: `End ${i}` }),
            type: "swim-end",
          });
        }

        // Add aid-station waypoints (should not affect pairing validation)
        for (let i = 0; i < aidCount; i++) {
          classified.push({
            waypoint: makeWaypoint({ symbol: "3", name: `Aid ${i}` }),
            type: "aid-station",
          });
        }

        const result = validateSwimPairing(classified);
        assertEquals(result.valid, true);
      },
    ),
    { numRuns: 100 },
  );
});
