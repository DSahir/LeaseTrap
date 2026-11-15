import { z } from "zod";
import { EmailRequestSchema, EmailResponseSchema, type EmailRequest, type EmailResponse } from "@/lib/contract";
import { generateJson, GeminiRequestError } from "@/lib/gemini";
import { loadLegalContext } from "@/lib/legal";
import { buildEmailPrompt } from "@/lib/prompt";
import { SERVER_LIMITS } from "@/lib/limits";
import { requestFault } from "@/lib/apiServer";

const EmailSchema = z.toJSONSchema(EmailResponseSchema);
const PRIMARY_MODEL = process.env.GEMINI_MODEL?.trim() || "gemini-3.5-flash-lite";
const FALLBACK_MODEL = process.env.GEMINI_MODEL_FALLBACK?.trim() || "gemini-3.1-flash-lite";
const UNSAFE_EMAIL_TEXT = /\b(?:sue|lawsuit|file a complaint|report you|illegal|void|unenforceable)\b/i;
const PLACEHOLDER = /\[(?:TENANT|ROOMMATE|GUARANTOR)_\d+\]|\[(?:LANDLORD|MANAGER|PROPERTY_ADDRESS|ADDRESS|PHONE|EMAIL|SSN|NUMBER|DOB|ZIP)\]/g;

type Generate = (prompt: string, model: string, schema: unknown, timeoutMs: number) => Promise<string>;

export async function draftEmail(
  input: EmailRequest,
  options: { generate?: Generate } = {},
): Promise<EmailResponse> {
  const parsed = EmailRequestSchema.safeParse(input);
  if (!parsed.success) throw requestFault("BAD_REQUEST");

  const legal = await loadLegalContext("");
  const prompt = await buildEmailPrompt(parsed.data, legal.citations);
  const generate = options.generate ?? generateJson;
  const deadline = Date.now() + SERVER_LIMITS.emailBudgetMs;

  for (let attempt = 0; attempt < 2; attempt += 1) {
    const remaining = deadline - Date.now();
    if (remaining <= 0) break;
    const retryPrompt = attempt === 0
      ? prompt
      : `${prompt}\n\nThe previous response was invalid. Return only a safe JSON email matching the schema.`;
    const raw = await generateWithFallback(generate, retryPrompt, remaining);
    const response = parseEmail(raw);
    if (response && isSafeEmail(response, parsed.data)) return response;
  }

  throw requestFault("MODEL_FAILURE");
}

async function generateWithFallback(generate: Generate, prompt: string, remainingMs: number): Promise<string> {
  const deadline = Date.now() + remainingMs;
  const timeoutMs = Math.min(SERVER_LIMITS.modelTimeoutMs, deadline - Date.now());
  try {
    return await generate(prompt, PRIMARY_MODEL, EmailSchema, timeoutMs);
  } catch (error) {
    if (error instanceof GeminiRequestError && error.status === 429) throw requestFault("MODEL_FAILURE");
    const availableMs = Math.min(SERVER_LIMITS.modelTimeoutMs, deadline - Date.now());
    if (availableMs <= 0 || PRIMARY_MODEL === FALLBACK_MODEL) throw requestFault("MODEL_FAILURE");
    return generate(prompt, FALLBACK_MODEL, EmailSchema, availableMs);
  }
}

function parseEmail(raw: string): EmailResponse | null {
  try {
    const parsed = EmailResponseSchema.safeParse(JSON.parse(raw) as unknown);
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}

function isSafeEmail(response: EmailResponse, input: EmailRequest): boolean {
  const content = `${response.subject}\n${response.body}`;
  if (UNSAFE_EMAIL_TEXT.test(content)) return false;

  const inputPlaceholders = new Set(
    input.clauses.flatMap((clause) => `${clause.plain_english}\n${clause.question_for_landlord}`.match(PLACEHOLDER) ?? []),
  );
  const outputPlaceholders = new Set(content.match(PLACEHOLDER) ?? []);
  return [...inputPlaceholders].every((placeholder) => outputPlaceholders.has(placeholder)) &&
    [...outputPlaceholders].every((placeholder) => inputPlaceholders.has(placeholder));
}
