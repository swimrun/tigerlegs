import { expect, it } from "vitest";
import {
  LARGE_FILE_BYTES,
  largeFileNotice,
  MAX_FILE_SIZE_BYTES,
  readFileAsText,
  validateFile,
} from "../../src/client/file-upload.ts";

it("largeFileNotice: none for small files, a warning from the threshold", () => {
  expect(largeFileNotice(LARGE_FILE_BYTES - 1)).toEqual(null);
  const upload = largeFileNotice(LARGE_FILE_BYTES)!;
  expect(upload.includes("battery") && upload.includes("not uploaded")).toEqual(true);
  expect(largeFileNotice(LARGE_FILE_BYTES, true)!.includes("mobile data")).toEqual(true);
});

/** Helper to create a File with given name and size */
function createFile(name: string, size: number, content = ""): File {
  const buffer = content || "x".repeat(size);
  return new File([buffer], name);
}

it("MAX_FILE_SIZE_BYTES is 10 MB", () => {
  expect(MAX_FILE_SIZE_BYTES).toEqual(10 * 1024 * 1024);
  expect(MAX_FILE_SIZE_BYTES).toEqual(10_485_760);
});

it("validateFile accepts .gpx files within size limit", () => {
  const file = createFile("track.gpx", 100);
  expect(validateFile(file)).toEqual({ valid: true });
});

it("validateFile accepts .GPX extension (case-insensitive)", () => {
  const file = createFile("track.GPX", 100);
  expect(validateFile(file)).toEqual({ valid: true });
});

it("validateFile accepts .Gpx extension (mixed case)", () => {
  const file = createFile("track.Gpx", 100);
  expect(validateFile(file)).toEqual({ valid: true });
});

it("validateFile rejects non-.gpx extension", () => {
  const file = createFile("track.xml", 100);
  const result = validateFile(file);
  expect(result.valid).toEqual(false);
  expect(result.error).toEqual("Only GPX files are accepted");
});

it("validateFile rejects file with no extension", () => {
  const file = createFile("track", 100);
  const result = validateFile(file);
  expect(result.valid).toEqual(false);
  expect(result.error).toEqual("Only GPX files are accepted");
});

it("validateFile rejects file exceeding 10 MB", () => {
  const file = createFile("big.gpx", MAX_FILE_SIZE_BYTES + 1);
  const result = validateFile(file);
  expect(result.valid).toEqual(false);
  expect(result.error).toEqual("File exceeds the maximum allowed size of 10 MB");
});

it("validateFile accepts file at exactly 10 MB", () => {
  const file = createFile("exact.gpx", MAX_FILE_SIZE_BYTES);
  expect(validateFile(file)).toEqual({ valid: true });
});

it("readFileAsText reads file content as UTF-8 string", async () => {
  const content = '<?xml version="1.0"?><gpx></gpx>';
  const file = new File([content], "test.gpx");
  const text = await readFileAsText(file);
  expect(text).toEqual(content);
});
