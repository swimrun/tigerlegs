import { assertEquals } from "@std/assert";
import {
  LARGE_FILE_BYTES,
  largeFileNotice,
  MAX_FILE_SIZE_BYTES,
  readFileAsText,
  validateFile,
} from "../../src/client/file-upload.ts";

Deno.test("largeFileNotice: none for small files, a warning from the threshold", () => {
  assertEquals(largeFileNotice(LARGE_FILE_BYTES - 1), null);
  const upload = largeFileNotice(LARGE_FILE_BYTES)!;
  assertEquals(upload.includes("battery") && upload.includes("not uploaded"), true);
  assertEquals(largeFileNotice(LARGE_FILE_BYTES, true)!.includes("mobile data"), true);
});

/** Helper to create a File with given name and size */
function createFile(name: string, size: number, content = ""): File {
  const buffer = content || "x".repeat(size);
  return new File([buffer], name);
}

Deno.test("MAX_FILE_SIZE_BYTES is 10 MB", () => {
  assertEquals(MAX_FILE_SIZE_BYTES, 10 * 1024 * 1024);
  assertEquals(MAX_FILE_SIZE_BYTES, 10_485_760);
});

Deno.test("validateFile accepts .gpx files within size limit", () => {
  const file = createFile("track.gpx", 100);
  assertEquals(validateFile(file), { valid: true });
});

Deno.test("validateFile accepts .GPX extension (case-insensitive)", () => {
  const file = createFile("track.GPX", 100);
  assertEquals(validateFile(file), { valid: true });
});

Deno.test("validateFile accepts .Gpx extension (mixed case)", () => {
  const file = createFile("track.Gpx", 100);
  assertEquals(validateFile(file), { valid: true });
});

Deno.test("validateFile rejects non-.gpx extension", () => {
  const file = createFile("track.xml", 100);
  const result = validateFile(file);
  assertEquals(result.valid, false);
  assertEquals(result.error, "Only GPX files are accepted");
});

Deno.test("validateFile rejects file with no extension", () => {
  const file = createFile("track", 100);
  const result = validateFile(file);
  assertEquals(result.valid, false);
  assertEquals(result.error, "Only GPX files are accepted");
});

Deno.test("validateFile rejects file exceeding 10 MB", () => {
  const file = createFile("big.gpx", MAX_FILE_SIZE_BYTES + 1);
  const result = validateFile(file);
  assertEquals(result.valid, false);
  assertEquals(result.error, "File exceeds the maximum allowed size of 10 MB");
});

Deno.test("validateFile accepts file at exactly 10 MB", () => {
  const file = createFile("exact.gpx", MAX_FILE_SIZE_BYTES);
  assertEquals(validateFile(file), { valid: true });
});

Deno.test("readFileAsText reads file content as UTF-8 string", async () => {
  const content = '<?xml version="1.0"?><gpx></gpx>';
  const file = new File([content], "test.gpx");
  const text = await readFileAsText(file);
  assertEquals(text, content);
});
