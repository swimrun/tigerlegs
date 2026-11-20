import type { Lang } from "./language.ts";

/**
 * A number that a calculation wrote as text ("24.7", "6250") in the notation of the language: a decimal comma in Dutch,
 * French and German. The number of decimals stays as it was, and there is no thousands separator, as before.
 */
export function localizeNumber(text: string, lang: Lang): string {
  const value = Number(text);
  if (text.trim() === "" || !Number.isFinite(value)) return text;
  const decimals = text.split(".")[1]?.length ?? 0;
  return new Intl.NumberFormat(lang, { minimumFractionDigits: decimals, maximumFractionDigits: decimals, useGrouping: false }).format(value);
}
