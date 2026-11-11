import { expect } from "vitest";

// The unit tests were written for Deno's assertEquals, which treats +0 and -0 as equal; toEqual does not, and
// property tests that generate numbers do produce -0 now and then. Restore the old equality for numbers.
expect.addEqualityTesters([
  (a, b) => (typeof a === "number" && typeof b === "number" && a === b ? true : undefined),
]);
