/** Shared browser limits. Sample PDFs stay under 3 MB; the product cap is 25 MB. */
export const LIMITS = {
  maxPdfBytes: 25 * 1024 * 1024,
  maxTextChars: 200_000,
  minExtractedChars: 500,
  maxEmailClauses: 20,
  maxNameChars: 80,
  maxAddressChars: 160,
  maxNotesChars: 1000,
  auditTimeoutMs: 60_000,
  emailTimeoutMs: 45_000,
  copyResetMs: 2_000,
} as const;

export const FRIENDLY_ERRORS = {
  BAD_REQUEST: "We couldn't read that text. Please check it and try again.",
  TOO_LARGE: "That document is too long. Try pasting only the key sections.",
  RATE_LIMITED: "Too many requests, try again in a minute.",
  MODEL_FAILURE: "We couldn't analyze this text. Please try again.",
  DISABLED: "Analysis is temporarily unavailable. Try the demo lease.",
  PDF: "We couldn't read text from that PDF. If it is a scan, paste the key clauses below.",
  FILE_TYPE: "Please choose a PDF file.",
} as const;

export const MUNICIPALITIES = [
  { slug: "amherst", label: "Amherst" },
  { slug: "boston", label: "Boston" },
  { slug: "cambridge", label: "Cambridge" },
  { slug: "northampton", label: "Northampton" },
  { slug: "worcester", label: "Worcester" },
  { slug: "springfield", label: "Springfield" },
] as const;

export const TENANCY_TYPES = [
  { value: "", label: "Not specified" },
  { value: "fixed-term", label: "Fixed-term lease" },
  { value: "tenancy-at-will", label: "Tenancy at will" },
  { value: "sublet", label: "Sublet" },
] as const;

export const AUDIT_REQUEST_KEYS = ["text", "municipality", "tenancyType", "deepReview"] as const;

/** Practice data only. Production leaves this unset. */
export function isMockApiEnabled(): boolean {
  return process.env.NEXT_PUBLIC_USE_MOCK === "true";
}
