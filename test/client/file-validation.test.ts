/**
 * Property-based tests for file validation.
 *
 * **Validates: Requirements 1.1, 1.3, 1.6**
 *
 * Properties tested:
 * 1. Any file with .gpx extension (case-insensitive) AND size ≤ 10,485,760 bytes → valid: true
 * 2. Any file without .gpx extension → valid: false with "Only GPX files are accepted"
 * 3. Any file with .gpx extension but size > 10,485,760 bytes → valid: false with "File exceeds the maximum allowed size of 10 MB"
 * 4. Extension check is case-insensitive (.GPX, .Gpx, .gPx all valid)
 */

import { assertEquals, assert } from "@std/assert";
import fc from "fast-check";
import { validateFile, MAX_FILE_SIZE_BYTES } from "../../src/client/file-upload.ts";

/** Generate a random case variation of "gpx" */
const arbitraryGpxExtension: fc.Arbitrary<string> = fc
  .tuple(
    fc.constantFrom("g", "G"),
    fc.constantFrom("p", "P"),
    fc.constantFrom("x", "X"),
  )
  .map(([g, p, x]) => `.${g}${p}${x}`);

/** Generate a filename base (at least 1 char, no dots to avoid confusing extension logic) */
const arbitraryBaseName: fc.Arbitrary<string> = fc
  .stringOf(fc.constantFrom(...'abcdefghijklmnopqrstuvwxyz0123456789_-'.split('')), {
    minLength: 1,
    maxLength: 30,
  });

/** Generate a non-gpx extension (never matches .gpx case-insensitively) */
const arbitraryNonGpxExtension: fc.Arbitrary<string> = fc
  .stringOf(fc.constantFrom(...'abcdefghijklmnopqrstuvwxyz0123456789'.split('')), {
    minLength: 1,
    maxLength: 5,
  })
  .filter((ext) => ext.toLowerCase() !== "gpx")
  .map((ext) => `.${ext}`);

/**
 * Property 1: Any file with .gpx extension (case-insensitive) AND size ≤ MAX_FILE_SIZE_BYTES → valid: true
 */
Deno.test("Property: .gpx file within size limit is always valid", () => {
  fc.assert(
    fc.property(
      arbitraryBaseName,
      arbitraryGpxExtension,
      fc.integer({ min: 0, max: MAX_FILE_SIZE_BYTES }),
      (baseName, ext, size) => {
        const filename = `${baseName}${ext}`;
        const file = new File(["x".repeat(size)], filename);
        const result = validateFile(file);
        assertEquals(result, { valid: true });
      },
    ),
    { numRuns: 100 },
  );
});

/**
 * Property 2: Any file without .gpx extension → valid: false with "Only GPX files are accepted"
 */
Deno.test("Property: non-.gpx file is always rejected with correct error", () => {
  fc.assert(
    fc.property(
      arbitraryBaseName,
      arbitraryNonGpxExtension,
      fc.integer({ min: 0, max: 1000 }),
      (baseName, ext, size) => {
        const filename = `${baseName}${ext}`;
        const file = new File(["x".repeat(size)], filename);
        const result = validateFile(file);
        assertEquals(result.valid, false);
        assertEquals(result.error, "Only GPX files are accepted");
      },
    ),
    { numRuns: 100 },
  );
});

/**
 * Property 2b: File with no extension at all → valid: false
 */
Deno.test("Property: file with no extension is always rejected", () => {
  fc.assert(
    fc.property(
      arbitraryBaseName,
      fc.integer({ min: 0, max: 1000 }),
      (baseName, size) => {
        const file = new File(["x".repeat(size)], baseName);
        const result = validateFile(file);
        assertEquals(result.valid, false);
        assertEquals(result.error, "Only GPX files are accepted");
      },
    ),
    { numRuns: 100 },
  );
});

/**
 * Property 3: Any file with .gpx extension but size > MAX_FILE_SIZE_BYTES → valid: false with size error
 */
Deno.test("Property: .gpx file exceeding size limit is always rejected with size error", () => {
  fc.assert(
    fc.property(
      arbitraryBaseName,
      arbitraryGpxExtension,
      fc.integer({ min: MAX_FILE_SIZE_BYTES + 1, max: MAX_FILE_SIZE_BYTES + 1000 }),
      (baseName, ext, size) => {
        const filename = `${baseName}${ext}`;
        const file = new File(["x".repeat(size)], filename);
        const result = validateFile(file);
        assertEquals(result.valid, false);
        assertEquals(
          result.error,
          "File exceeds the maximum allowed size of 10 MB",
        );
      },
    ),
    { numRuns: 50 },
  );
});

/**
 * Property 4: Extension check is case-insensitive — all case variants of .gpx are valid
 */
Deno.test("Property: all case variations of .gpx extension are accepted", () => {
  // Exhaustively test all 8 case combinations of "gpx"
  const allCaseVariants = [
    ".gpx", ".gpX", ".gPx", ".gPX",
    ".Gpx", ".GpX", ".GPx", ".GPX",
  ];

  fc.assert(
    fc.property(
      arbitraryBaseName,
      fc.constantFrom(...allCaseVariants),
      fc.integer({ min: 0, max: 1000 }),
      (baseName, ext, size) => {
        const filename = `${baseName}${ext}`;
        const file = new File(["x".repeat(size)], filename);
        const result = validateFile(file);
        assertEquals(result, { valid: true });
      },
    ),
    { numRuns: 100 },
  );
});

/**
 * Property: boundary condition — file at exactly MAX_FILE_SIZE_BYTES is valid
 */
Deno.test("Property: .gpx file at exactly max size is valid", () => {
  fc.assert(
    fc.property(
      arbitraryBaseName,
      arbitraryGpxExtension,
      (baseName, ext) => {
        const filename = `${baseName}${ext}`;
        const file = new File(["x".repeat(MAX_FILE_SIZE_BYTES)], filename);
        const result = validateFile(file);
        assertEquals(result, { valid: true });
      },
    ),
    { numRuns: 5 },
  );
});
