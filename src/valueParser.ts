export type ParsedCell =
  | { kind: "currency"; value: number }
  | { kind: "percent"; value: number } // stored as a fraction, e.g. 0.297
  | { kind: "number"; value: number }
  | { kind: "text"; value: string }
  | { kind: "empty" };

/**
 * Converts a raw extracted string like "$969,421", "-29.7%", "144.6", or
 * "N/A for baskets" into a typed value suitable for writing to Excel with
 * the right number format. Falls back to plain text for anything that
 * isn't cleanly numeric (e.g. "7 Losses", "N/A for baskets").
 */
export function parseCell(raw: string | null): ParsedCell {
  if (raw === null || raw.trim().length === 0) return { kind: "empty" };
  const s = raw.trim();

  // Currency: optional leading -, $, digits with optional commas/decimals
  const currencyMatch = s.match(/^(-?)\$([\d,]+(?:\.\d+)?)$/);
  if (currencyMatch) {
    const sign = currencyMatch[1] === "-" ? -1 : 1;
    const num = parseFloat(currencyMatch[2].replace(/,/g, ""));
    return { kind: "currency", value: sign * num };
  }

  // Percent: optional -, digits/decimals, trailing %
  const percentMatch = s.match(/^(-?\d+(?:\.\d+)?)%$/);
  if (percentMatch) {
    return { kind: "percent", value: parseFloat(percentMatch[1]) / 100 };
  }

  // Plain number (integer or decimal, possibly with thousands separators)
  const numberMatch = s.match(/^-?[\d,]+(?:\.\d+)?$/);
  if (numberMatch) {
    return { kind: "number", value: parseFloat(s.replace(/,/g, "")) };
  }

  // Anything else -- "N/A for baskets", "7 Losses", etc. -- stays text.
  return { kind: "text", value: s };
}
