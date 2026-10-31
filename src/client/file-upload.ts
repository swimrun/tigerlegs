import type { ValidationResult } from "../shared/types.ts";

/** Maximum allowed file size: 10 MB (10 * 1024 * 1024 = 10,485,760 bytes) */
export const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024;

/**
 * Validate that a file is a .gpx file within the size limit.
 *
 * Checks:
 * 1. File has .gpx extension (case-insensitive)
 * 2. File size does not exceed MAX_FILE_SIZE_BYTES
 *
 * @param file - The file to validate
 * @returns ValidationResult with valid=true or valid=false with error message
 */
export function validateFile(file: File): ValidationResult {
  const name = file.name;
  const dotIndex = name.lastIndexOf(".");

  if (dotIndex === -1 || name.slice(dotIndex).toLowerCase() !== ".gpx") {
    return {
      valid: false,
      error: "Only GPX files are accepted",
    };
  }

  if (file.size > MAX_FILE_SIZE_BYTES) {
    return {
      valid: false,
      error: "File exceeds the maximum allowed size of 10 MB",
    };
  }

  return { valid: true };
}

/**
 * Read the file content as a UTF-8 string.
 *
 * @param file - The file to read
 * @returns Promise resolving to the file text content
 */
export function readFileAsText(file: File): Promise<string> {
  return file.text();
}
