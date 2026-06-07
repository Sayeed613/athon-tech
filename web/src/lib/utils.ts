import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * RFC 4180 compliant CSV field escaping.
 * Wraps field in quotes if it contains commas, quotes, or newlines.
 * Doubles any embedded quotes.
 */
export function escapeCSV(value: string | number | null | undefined): string {
  if (value == null) return "";
  const str = String(value);
  if (str.includes(",") || str.includes('"') || str.includes("\n") || str.includes("\r")) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

/**
 * Build a RFC 4180 compliant CSV row from an array of values.
 */
export function toCSVRow(values: (string | number | null | undefined)[]): string {
  return values.map(escapeCSV).join(",");
}
