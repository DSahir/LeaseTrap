/**
 * Frozen API contract (Phase 0).
 * Do not change this file without agreeing with Person A first.
 */
import { z } from "zod";

export const LEVELS = ["HIGH", "WORTH_ASKING", "STANDARD", "POSSIBLY_MISSING"] as const;
export const CATEGORIES = [
  "SECURITY_DEPOSIT", "FEES", "ENTRY", "REPAIRS", "RENEWAL",
  "LIABILITY", "SUBLETTING", "DISCLOSURES", "OTHER",
] as const;
export const CONFIDENCE = ["HIGH", "MEDIUM", "LOW"] as const;

// ---- What Gemini returns (spec 9.2) ----
export const ModelClauseSchema = z.object({
  id: z.string(),
  level: z.enum(LEVELS),
  category: z.enum(CATEGORIES),
  quote: z.string().nullable(),            // null only for POSSIBLY_MISSING
  plain_english: z.string(),
  legal_reference_ids: z.array(z.string()),
  why_flagged: z.string(),
  confidence: z.enum(CONFIDENCE),
  question_for_landlord: z.string(),
});
export const CountsSchema = z.object({
  high: z.number(), worth_asking: z.number(),
  standard: z.number(), possibly_missing: z.number(),
});
export const ModelOutputSchema = z.object({
  summary: z.string(),
  counts: CountsSchema,
  clauses: z.array(ModelClauseSchema),
  unsupported_notes: z.array(z.string()),
});

// ---- What the server returns to the browser ----
// Server adds ma_statute_citation by looking up legal_reference_ids in legal/refs.json
export const CitationSchema = z.object({
  id: z.string(), title: z.string(), citation: z.string(), url: z.string().url(),
  scope_note: z.string().optional(),
});
export const ClauseSchema = ModelClauseSchema.extend({
  ma_statute_citation: z.array(CitationSchema),
});
export const AuditResponseSchema = z.object({
  summary: z.string(),
  counts: CountsSchema,                    // recomputed server-side from clauses
  clauses: z.array(ClauseSchema),
  unsupported_notes: z.array(z.string()),
  legal_last_verified: z.string(),         // ISO date, shown in app footer (spec 7.1 rule 5)
});

export const AuditRequestSchema = z.object({
  text: z.string().min(1).max(200_000),    // spec 6.7: 200 KB cap
  municipality: z.string().max(60),        // slug: lowercase, hyphenated, e.g. "amherst"
  tenancyType: z.string().max(40).optional(),
  deepReview: z.boolean().optional(),      // spec 8.3 optional stronger model
});

// ---- Email (spec 9.3, 11.1) ----
export const EmailClauseInputSchema = z.object({
  category: z.enum(CATEGORIES),
  plain_english: z.string(),
  question_for_landlord: z.string(),
  citations: z.array(z.string()),          // e.g. ["M.G.L. c. 186 § 15B"]
});
export const EmailRequestSchema = z.object({
  clauses: z.array(EmailClauseInputSchema).min(1).max(20),
  tone: z.enum(["collaborative", "direct"]),
  notes: z.string().max(1000).optional(),
});
export const EmailResponseSchema = z.object({ subject: z.string(), body: z.string() });

// ---- Errors (spec 11.1) ----
export const ERROR_CODES = ["BAD_REQUEST","TOO_LARGE","RATE_LIMITED","MODEL_FAILURE","DISABLED"] as const;
export const ApiErrorSchema = z.object({ error: z.string(), code: z.enum(ERROR_CODES) });
// 400 BAD_REQUEST, 413 TOO_LARGE, 429 RATE_LIMITED, 502 MODEL_FAILURE, 503 DISABLED (kill switch)

export type ModelOutput = z.infer<typeof ModelOutputSchema>;
export type Clause = z.infer<typeof ClauseSchema>;
export type AuditRequest = z.infer<typeof AuditRequestSchema>;
export type AuditResponse = z.infer<typeof AuditResponseSchema>;
export type EmailRequest = z.infer<typeof EmailRequestSchema>;
export type EmailResponse = z.infer<typeof EmailResponseSchema>;
export type ApiError = z.infer<typeof ApiErrorSchema>;
export type Level = (typeof LEVELS)[number];
export type Category = (typeof CATEGORIES)[number];
