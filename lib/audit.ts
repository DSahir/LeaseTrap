import { z } from "zod";
import {
  AuditRequestSchema,
  ModelOutputSchema,
  type AuditResponse,
  type Level,
} from "@/lib/contract";
import { generateJson, GeminiRequestError } from "@/lib/gemini";
import { loadLegalContext } from "@/lib/legal";
import { buildAuditPrompt } from "@/lib/prompt";
import { SERVER_LIMITS } from "@/lib/limits";
import { requestFault } from "@/lib/apiServer";

const ModelSchema = z.toJSONSchema(ModelOutputSchema);
const PRIMARY_MODEL = process.env.GEMINI_MODEL?.trim() || "gemini-3.5-flash-lite";
const FALLBACK_MODEL = process.env.GEMINI_MODEL_FALLBACK?.trim() || "gemini-3.1-flash-lite";

type Generate = (prompt: string, model: string, schema: unknown, timeoutMs: number) => Promise<string>;

export class AuditModelFailure extends Error {
  constructor(readonly reason: "provider_rate_limited" | "fallback_unavailable" | "invalid_model_output") {
    super("Audit model request failed");
  }
}

export async function runAudit(
  input: unknown,
  options: { generate?: Generate } = {},
): Promise<AuditResponse> {
  if (
    typeof input === "object" &&
    input !== null &&
    "text" in input &&
    typeof input.text === "string" &&
    input.text.length > SERVER_LIMITS.maxTextChars
  ) {
    throw requestFault("TOO_LARGE");
  }
  const parsedInput = AuditRequestSchema.safeParse(input);
  if (!parsedInput.success) throw requestFault("BAD_REQUEST");
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(parsedInput.data.municipality)) {
    throw requestFault("BAD_REQUEST");
  }
  if (
    parsedInput.data.tenancyType !== undefined &&
    !["fixed-term", "tenancy-at-will", "sublet"].includes(parsedInput.data.tenancyType)
  ) {
    throw requestFault("BAD_REQUEST");
  }

  const legal = await loadLegalContext(parsedInput.data.municipality);
  const basePrompt = await buildAuditPrompt(parsedInput.data, legal.pack, legal.localRules);
  const generate = options.generate ?? generateJson;
  const deadline = Date.now() + SERVER_LIMITS.auditBudgetMs;

  for (let attempt = 0; attempt < 2; attempt += 1) {
    const remaining = deadline - Date.now();
    if (remaining <= 0) break;
    const prompt = attempt === 0
      ? basePrompt
      : `${basePrompt}\n\nThe previous response was invalid. Return exactly one JSON object matching the required schema.`;
    const raw = await generateWithFallback(generate, prompt, remaining);
    const parsedOutput = parseModelOutput(raw);
    if (parsedOutput) {
      return postProcess(parsedOutput, legal.citations, parsedInput.data.text, legal.legalLastVerified);
    }
  }

  throw new AuditModelFailure("invalid_model_output");
}

async function generateWithFallback(generate: Generate, prompt: string, remainingMs: number): Promise<string> {
  const deadline = Date.now() + remainingMs;
  const timeoutMs = Math.min(SERVER_LIMITS.modelTimeoutMs, deadline - Date.now());
  try {
    return await generate(prompt, PRIMARY_MODEL, ModelSchema, timeoutMs);
  } catch (error) {
    if (error instanceof GeminiRequestError && error.status === 429) {
      throw new AuditModelFailure("provider_rate_limited");
    }
    const availableMs = Math.min(SERVER_LIMITS.modelTimeoutMs, deadline - Date.now());
    if (availableMs <= 0 || PRIMARY_MODEL === FALLBACK_MODEL) {
      throw new AuditModelFailure("fallback_unavailable");
    }
    return generate(prompt, FALLBACK_MODEL, ModelSchema, availableMs);
  }
}

function parseModelOutput(raw: string) {
  try {
    const result = ModelOutputSchema.safeParse(JSON.parse(raw) as unknown);
    if (!result.success || containsForbiddenVerdict(result.data)) return null;
    return result.data;
  } catch {
    return null;
  }
}

function containsForbiddenVerdict(output: z.infer<typeof ModelOutputSchema>): boolean {
  const content = [
    output.summary,
    ...output.unsupported_notes,
    ...output.clauses.flatMap((clause) => [
      clause.plain_english,
      clause.why_flagged,
      clause.question_for_landlord,
    ]),
  ].join("\n");
  return /\b(?:illegal|void|unenforceable|will not hold up in court)\b/i.test(content);
}

function postProcess(
  output: z.infer<typeof ModelOutputSchema>,
  citations: Awaited<ReturnType<typeof loadLegalContext>>["citations"],
  sourceText: string,
  legalLastVerified: string,
): AuditResponse {
  const citationById = new Map(citations.map((citation) => [citation.id, citation]));
  const clauses = output.clauses
    .filter((clause) => clause.level === "POSSIBLY_MISSING" || clause.quote !== null)
    .map((clause) => {
      const resolved = [...new Set(clause.legal_reference_ids)]
        .map((id) => citationById.get(id))
        .filter((citation): citation is NonNullable<typeof citation> => citation !== undefined);
      const hasVerifiedQuote = clause.quote === null || containsNormalizedQuote(sourceText, clause.quote);
      const noVerifiedCitation = resolved.length === 0;
      const shouldDowngrade = noVerifiedCitation || !hasVerifiedQuote;
      const level: Level = shouldDowngrade && clause.level === "HIGH" ? "WORTH_ASKING" : clause.level;
      return {
        ...clause,
        legal_reference_ids: resolved.map((citation) => citation.id),
        level,
        confidence: shouldDowngrade ? "LOW" as const : clause.confidence,
        ma_statute_citation: resolved,
      };
    });

  return {
    summary: output.summary,
    counts: {
      high: clauses.filter((clause) => clause.level === "HIGH").length,
      worth_asking: clauses.filter((clause) => clause.level === "WORTH_ASKING").length,
      standard: clauses.filter((clause) => clause.level === "STANDARD").length,
      possibly_missing: clauses.filter((clause) => clause.level === "POSSIBLY_MISSING").length,
    },
    clauses,
    unsupported_notes: output.unsupported_notes,
    legal_last_verified: legalLastVerified,
  };
}

function containsNormalizedQuote(source: string, quote: string): boolean {
  const normalize = (value: string) => value.replace(/\s+/g, " ").trim();
  return normalize(source).includes(normalize(quote));
}
