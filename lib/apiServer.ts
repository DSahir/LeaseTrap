import { SERVER_LIMITS } from "@/lib/limits";
import { consumeRateLimit, getClientId } from "@/lib/ratelimit";

type ApiErrorCode = "BAD_REQUEST" | "TOO_LARGE" | "RATE_LIMITED" | "MODEL_FAILURE" | "DISABLED";
type Endpoint = "audit" | "email";

const STATUS_BY_CODE: Record<ApiErrorCode, number> = {
  BAD_REQUEST: 400,
  TOO_LARGE: 413,
  RATE_LIMITED: 429,
  MODEL_FAILURE: 502,
  DISABLED: 503,
};

const MESSAGE_BY_CODE: Record<ApiErrorCode, string> = {
  BAD_REQUEST: "We couldn't read that text. Please check it and try again.",
  TOO_LARGE: "That document is too long. Try pasting only the key sections.",
  RATE_LIMITED: "Too many requests, try again in a minute.",
  MODEL_FAILURE: "We couldn't analyze this text. Please try again.",
  DISABLED: "Analysis is temporarily unavailable. Try the demo lease.",
};

export class ApiFault extends Error {
  constructor(readonly code: ApiErrorCode) {
    super(code);
  }
}

export async function handleJsonPost<Input, Output>(
  request: Request,
  endpoint: Endpoint,
  parse: (value: unknown) => Input,
  action: (input: Input) => Promise<Output>,
): Promise<Response> {
  try {
    if (process.env.AUDIT_DISABLED === "true") throw new ApiFault("DISABLED");

    const body = await readJsonBody(request);
    const input = parse(body);
    if (!consumeRateLimit(endpoint, getClientId(request.headers))) throw new ApiFault("RATE_LIMITED");

    return jsonResponse(await action(input), 200);
  } catch (error) {
    if (error instanceof ApiFault) return errorResponse(error.code);

    console.error("API_ROUTE_FAILURE", JSON.stringify({ route: endpoint, code: "MODEL_FAILURE" }));
    return errorResponse("MODEL_FAILURE");
  }
}

export function requestFault(code: ApiErrorCode): ApiFault {
  return new ApiFault(code);
}

export function jsonResponse(value: unknown, status = 200): Response {
  return Response.json(value, {
    status,
    headers: {
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}

async function readJsonBody(request: Request): Promise<unknown> {
  const contentType = request.headers.get("content-type") ?? "";
  if (!/^application\/json(?:\s*;|$)/i.test(contentType)) throw new ApiFault("BAD_REQUEST");

  const declaredLength = Number(request.headers.get("content-length"));
  if (Number.isFinite(declaredLength) && declaredLength > SERVER_LIMITS.maxRequestBytes) {
    throw new ApiFault("TOO_LARGE");
  }

  if (!request.body) throw new ApiFault("BAD_REQUEST");

  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > SERVER_LIMITS.maxRequestBytes) {
        await reader.cancel();
        throw new ApiFault("TOO_LARGE");
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }

  const bytes = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }

  try {
    return JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes)) as unknown;
  } catch {
    throw new ApiFault("BAD_REQUEST");
  }
}

function errorResponse(code: ApiErrorCode): Response {
  const response = jsonResponse({ error: MESSAGE_BY_CODE[code], code }, STATUS_BY_CODE[code]);
  if (code === "RATE_LIMITED") response.headers.set("Retry-After", "60");
  return response;
}
