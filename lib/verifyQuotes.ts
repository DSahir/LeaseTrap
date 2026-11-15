export function normalizeWhitespace(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

export type QuoteStatus = "none" | "verified" | "unverified";

/** A quote counts only when it appears in the scrubbed text the user is sending. */
export function quoteStatus(quote: string | null, source: string): QuoteStatus {
  if (!quote || quote.trim().length === 0) return "none";
  const haystack = normalizeWhitespace(source);
  const needle = normalizeWhitespace(quote);
  if (needle.length === 0) return "none";
  return haystack.includes(needle) ? "verified" : "unverified";
}
