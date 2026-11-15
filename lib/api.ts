import { FRIENDLY_ERRORS, isMockApiEnabled, LIMITS } from "@/lib/config";
import {
  ApiErrorSchema,
  AuditRequestSchema,
  AuditResponseSchema,
  EmailRequestSchema,
  EmailResponseSchema,
  type AuditRequest,
  type AuditResponse,
  type EmailRequest,
  type EmailResponse,
} from "@/lib/contract";
import { sanitizeEmailRequest } from "@/lib/emailClient";

const STATUS_CODES = {
  400: "BAD_REQUEST",
  413: "TOO_LARGE",
  429: "RATE_LIMITED",
  502: "MODEL_FAILURE",
  503: "DISABLED",
} as const;

export function buildAuditPayload(input: {
  text: string;
  municipality: string;
  tenancyType?: string;
}): AuditRequest {
  const payload: AuditRequest = {
    text: input.text,
    municipality: input.municipality,
  };
  if (input.tenancyType) payload.tenancyType = input.tenancyType;
  return payload;
}

export async function requestAudit(input: {
  text: string;
  municipality: string;
  tenancyType?: string;
  signal?: AbortSignal;
}): Promise<AuditResponse> {
  const payload = buildAuditPayload(input);
  const parsed = AuditRequestSchema.safeParse(payload);
  if (!parsed.success) {
    if (input.text.length > LIMITS.maxTextChars) throw new Error(FRIENDLY_ERRORS.TOO_LARGE);
    throw new Error(FRIENDLY_ERRORS.BAD_REQUEST);
  }
  if (isMockApiEnabled()) return loadMockAudit();
  return postJson("/api/audit", parsed.data, AuditResponseSchema, LIMITS.auditTimeoutMs, input.signal);
}

export async function requestEmail(
  input: EmailRequest,
  signal?: AbortSignal,
  placeholderMap: Record<string, string> = {},
): Promise<EmailResponse> {
  const parsed = EmailRequestSchema.safeParse(input);
  if (!parsed.success) throw new Error(FRIENDLY_ERRORS.BAD_REQUEST);
  if (isMockApiEnabled()) {
    const { buildLocalEmail } = await import("@/lib/emailClient");
    return buildLocalEmail(parsed.data);
  }
  const safeRequest = sanitizeEmailRequest(parsed.data, placeholderMap);
  return postJson("/api/email", safeRequest, EmailResponseSchema, LIMITS.emailTimeoutMs, signal);
}

export async function loadDemoBundle(): Promise<{ text: string; result: AuditResponse } | null> {
  try {
    const [textResponse, resultResponse] = await Promise.all([
      fetch("/samples/demo-lease.txt"),
      fetch("/samples/demo-result.json"),
    ]);
    if (!textResponse.ok || !resultResponse.ok) return null;
    const text = await textResponse.text();
    const body: unknown = await resultResponse.json();
    const parsed = AuditResponseSchema.safeParse(body);
    if (!parsed.success || text.trim().length === 0) return null;
    return { text, result: parsed.data };
  } catch {
    return null;
  }
}

export async function loadTownSlugs(): Promise<string[]> {
  try {
    const response = await fetch("/legal/loaded-towns.json");
    if (!response.ok) return [];
    const body: unknown = await response.json();
    if (!Array.isArray(body)) return [];
    return body.filter((item): item is string => typeof item === "string");
  } catch {
    return [];
  }
}

async function loadMockAudit(): Promise<AuditResponse> {
  const imported: unknown = (await import("@/mock/audit.json")).default;
  const parsed = AuditResponseSchema.safeParse(imported);
  if (!parsed.success) throw new Error(FRIENDLY_ERRORS.MODEL_FAILURE);
  return parsed.data;
}

async function postJson<T>(
  url: string,
  payload: unknown,
  schema: { safeParse: (value: unknown) => { success: true; data: T } | { success: false } },
  timeoutMs: number,
  signal?: AbortSignal,
): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  const onAbort = () => controller.abort();
  signal?.addEventListener("abort", onAbort);
  try {
    const response = await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
      signal: controller.signal,
      cache: "no-store",
    });
    if (!response.ok) throw new Error(await messageForResponse(response));
    const body: unknown = await response.json();
    const parsed = schema.safeParse(body);
    if (!parsed.success) throw new Error(FRIENDLY_ERRORS.MODEL_FAILURE);
    return parsed.data;
  } catch (error) {
    if (error instanceof Error && isFriendlyMessage(error.message)) throw error;
    throw new Error(FRIENDLY_ERRORS.MODEL_FAILURE);
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener("abort", onAbort);
  }
}

function isFriendlyMessage(message: string): boolean {
  return (Object.values(FRIENDLY_ERRORS) as string[]).includes(message);
}

async function messageForResponse(response: Response): Promise<string> {
  let code: keyof typeof FRIENDLY_ERRORS | undefined = STATUS_CODES[response.status as keyof typeof STATUS_CODES];
  try {
    const body: unknown = await response.json();
    const parsed = ApiErrorSchema.safeParse(body);
    if (parsed.success) code = parsed.data.code;
  } catch {
    code = STATUS_CODES[response.status as keyof typeof STATUS_CODES];
  }
  if (!code) return FRIENDLY_ERRORS.MODEL_FAILURE;
  return FRIENDLY_ERRORS[code];
}
